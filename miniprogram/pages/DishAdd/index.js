const app = getApp()

Page({
  data: {
    _id: '',
    name: '',
    description: '',
    imageUrl: '',
    tempFilePath: '',
    isEdit: false,
    categories: [],
    categoryIndex: 0,
    saving: false,
  },

  async onLoad(options) {
    await app.loadCategories()
    this.setData({ categories: app.globalData.categories })
    if (options.id) {
      this.setData({ _id: options.id, isEdit: true })
      wx.setNavigationBarTitle({ title: '编辑菜品' })
    }
  },

  async onShow() {
    if (this.data.isEdit && this.data._id) {
      await this.loadDish()
    }
  },

  // 加载菜品信息（编辑模式）
  async loadDish() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoupleData',
        data: {
          collection: app.globalData.collectionDishList,
          docId: this.data._id
        }
      })

      if (!res.result?.success) {
        throw new Error(res.result?.message || '加载失败')
      }

      const dish = res.result.data
      const categoryIndex = this.data.categories.findIndex(c => c._id === dish.category) || 0
      this.setData({
        name: dish.name,
        description: dish.description || '',
        imageUrl: dish.imageUrl || '',
        categoryIndex: categoryIndex >= 0 ? categoryIndex : 0
      })
    } catch (e) {
      console.error('加载菜品失败', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 输入菜品名称
  onNameInput(e) {
    let value = e.detail.value
    if (value.length > 20) value = value.slice(0, 20)
    this.setData({ name: value })
    return value
  },

  // 输入菜品描述
  onDescInput(e) {
    let value = e.detail.value
    if (value.length > 6) value = value.slice(0, 6)
    this.setData({ description: value })
    return value
  },

  // 选择分类
  onCategoryChange(e) {
    this.setData({ categoryIndex: e.detail.value })
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({
          tempFilePath,
          imageUrl: tempFilePath
        })
      }
    })
  },

  // 上传图片到云存储
  async uploadImage() {
    if (!this.data.tempFilePath) return ''

    const cloudPath = `dishes/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

    try {
      const res = await wx.cloud.uploadFile({
        cloudPath,
        filePath: this.data.tempFilePath
      })
      return res.fileID
    } catch (e) {
      console.error('上传图片失败', e)
      throw new Error('图片上传失败')
    }
  },

  // 保存菜品
  async saveDish() {
    if (!app.isBound()) {
      wx.showToast({ title: '请先绑定伴侣', icon: 'none' })
      return
    }

    const { name, saving, isEdit, _id } = this.data

    if (saving) return

    if (!name.trim()) {
      wx.showToast({ title: '请输入菜品名称', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })

    try {
      let imageUrl = this.data.imageUrl

      // 如果有新选择的图片，上传新图片
      if (this.data.tempFilePath) {
        imageUrl = await this.uploadImage()
      }

      const db = await app.database()

      const category = this.data.categories[this.data.categoryIndex]._id

      if (isEdit) {
        // 编辑模式：更新现有记录
        const res = await wx.cloud.callFunction({
          name: 'updateCoupleData',
          data: {
            collection: app.globalData.collectionDishList,
            docId: _id,
            action: 'update',
            data: {
              name: name.trim(),
              description: this.data.description.trim(),
              imageUrl,
              category,
              updateTime: new Date(),
            }
          }
        })

        wx.hideLoading()

        if (!res.result?.success) {
          wx.showToast({ title: res.result?.message || '修改失败', icon: 'none' })
          return
        }

        wx.showToast({ title: '修改成功', icon: 'success' })
      } else {
        // 新增模式（带上 coupleId）
        const coupleId = app.globalData.currentUser?.coupleId || ''
        await db.collection(app.globalData.collectionDishList).add({
          data: {
            name: name.trim(),
            description: this.data.description.trim(),
            imageUrl,
            category,
            coupleId,
            createTime: db.serverDate(),
          }
        })
        wx.hideLoading()
        wx.showToast({ title: '添加成功', icon: 'success' })
      }

      setTimeout(() => {
        wx.navigateBack()
      }, 1500)

    } catch (e) {
      console.error('保存失败', e)
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
      this.setData({ saving: false })
    }
  },

  // 重置表单
  resetForm() {
    this.setData({
      name: '',
      description: '',
      imageUrl: '',
      tempFilePath: '',
      categoryIndex: 0
    })
  },
})
