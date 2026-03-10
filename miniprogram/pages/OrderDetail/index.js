const app = getApp()

Page({
  data: {
    order: null,
    loading: true,
  },

  onLoad(options) {
    if (options.id) {
      this.loadOrder(options.id)
    }
  },


  async loadOrder(id) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoupleData',
        data: {
          collection: app.globalData.collectionOrderList,
          docId: id
        }
      })

      if (!res.result?.success) {
        throw new Error(res.result?.message || '加载失败')
      }

      const order = res.result.data
      order.dateText = this.formatDate(order.createTime)
      order.timeText = this.formatTime(order.createTime)
      order.creatorName = await this.getCreatorName(order._openid)
      this.setData({ order, loading: false })
    } catch (e) {
      console.error('加载订单失败', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  async getCreatorName(openid) {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenId' })
      const myOpenid = res.result?.openid || ''
      if (openid === myOpenid) return '你'
      return app.getPartnerName(myOpenid)
    } catch (e) {
      return '对方'
    }
  },

  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    const year = d.getFullYear()
    const month = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${year}年${month}月${day}日`
  },

  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const hours = d.getHours().toString().padStart(2, '0')
    const minutes = d.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  },

  // 再来一单
  reorder() {
    const dishIds = this.data.order.dishes.map(d => d._id).join(',')
    wx.requestSubscribeMessage({
      tmplIds: app.globalData.notifyTmplIds,
      complete: () => {
        wx.switchTab({
          url: '/pages/Order/index',
          success: () => {
            app.globalData.reorderDishIds = dishIds
          }
        })
      }
    })
  },

  // 上传成品照片
  async uploadPhoto() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed']
      })

      if (!res.tempFiles || res.tempFiles.length === 0) return

      wx.showLoading({ title: '上传中...', mask: true })

      const tempPath = res.tempFiles[0].tempFilePath
      const cloudPath = `finished_photos/${this.data.order._id}_${Date.now()}.jpg`

      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempPath
      })

      await this.saveFinishedPhoto(uploadRes.fileID)

      wx.hideLoading()
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (e) {
      wx.hideLoading()
      if (e.errMsg && e.errMsg.includes('cancel')) return
      console.error('上传照片失败', e)
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  // 保存照片到订单记录
  async saveFinishedPhoto(fileID) {
    await wx.cloud.callFunction({
      name: 'updateCoupleData',
      data: {
        collection: app.globalData.collectionOrderList,
        docId: this.data.order._id,
        action: 'update',
        data: { finishedPhoto: fileID }
      }
    })

    this.setData({ 'order.finishedPhoto': fileID })
  },

  // 预览照片
  previewPhoto() {
    if (!this.data.order.finishedPhoto) return
    wx.previewImage({
      urls: [this.data.order.finishedPhoto],
      current: this.data.order.finishedPhoto
    })
  },

  // 更换照片
  changePhoto() {
    this.uploadPhoto()
  },

  // 删除照片
  deletePhoto() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这张成品照片吗？',
      success: async (res) => {
        if (!res.confirm) return

        wx.showLoading({ title: '删除中...', mask: true })

        try {
          // 删除云存储文件
          if (this.data.order.finishedPhoto) {
            await wx.cloud.deleteFile({
              fileList: [this.data.order.finishedPhoto]
            })
          }

          // 更新订单记录
          await wx.cloud.callFunction({
            name: 'updateCoupleData',
            data: {
              collection: app.globalData.collectionOrderList,
              docId: this.data.order._id,
              action: 'update',
              data: { finishedPhoto: '' }
            }
          })

          this.setData({ 'order.finishedPhoto': '' })

          wx.hideLoading()
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (e) {
          wx.hideLoading()
          console.error('删除照片失败', e)
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      }
    })
  },
})
