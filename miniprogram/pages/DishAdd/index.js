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

  onLoad(options) {
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
      const db = await app.database()
      const res = await db.collection(app.globalData.collectionDishList)
        .doc(this.data._id)
        .get()

      const dish = res.data
      const categoryIndex = this.data.categories.findIndex(c => c.id === dish.category) || 0
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
    this.setData({ name: e.detail.value })
  },

  // 输入菜品描述
  onDescInput(e) {
    this.setData({ description: e.detail.value })
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

      const category = this.data.categories[this.data.categoryIndex].id

      if (isEdit) {
        // 编辑模式：更新现有记录
        await db.collection(app.globalData.collectionDishList)
          .doc(_id)
          .update({
            data: {
              name: name.trim(),
              description: this.data.description.trim(),
              imageUrl,
              category,
              updateTime: db.serverDate(),
            }
          })
        wx.hideLoading()
        wx.showToast({ title: '修改成功', icon: 'success' })
      } else {
        // 新增模式
        await db.collection(app.globalData.collectionDishList).add({
          data: {
            name: name.trim(),
            description: this.data.description.trim(),
            imageUrl,
            category,
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
