const app = getApp()

Page({
  data: {
    dishes: [],
    allDishes: [],
    categories: [],
    dishesByCategory: {},
    categoryCount: {},
    selectedByCategory: {},
    currentCategory: '',
    categoryScrollId: '',
    dishScrollId: '',
    selectedCount: 0,
    selectedDishes: [],
    loading: true,
    showSuccess: false,
    showRemarkModal: false,
    showCartPanel: false,
    showDishDetail: false,
    detailClosing: false,
    currentDish: null,
    detailTranslateY: 0,
    remark: '',
    submitting: false,
    partnerName: '对方',
    categoryTops: [],
    searchKey: '',
  },

  async onShow() {
    await this.getPartnerName()
    await this.loadDishes()
  },

  // 获取伴侣名字
  async getPartnerName() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenId' })
      const openid = res.result?.openid || ''
      const partnerName = app.getPartnerName(openid)
      this.setData({ partnerName })
    } catch (e) {
      console.error('获取伴侣名字失败', e)
    }
  },

  // 加载菜品
  async loadDishes() {
    this.setData({ loading: true })
    try {
      const db = await app.database()
      const res = await db.collection(app.globalData.collectionDishList)
        .orderBy('createTime', 'desc')
        .limit(100)
        .get()

      // 检查是否有再来一单的菜品
      const reorderIds = app.globalData.reorderDishIds ? app.globalData.reorderDishIds.split(',') : []
      app.globalData.reorderDishIds = null

      const dishes = res.data.map(item => ({
        ...item,
        selected: reorderIds.includes(item._id),
        category: item.category || 'meat'
      }))

      const categories = app.globalData.categories
      const dishesByCategory = {}
      const categoryCount = {}
      const selectedByCategory = {}

      categories.forEach(cat => {
        dishesByCategory[cat.id] = dishes.filter(d => d.category === cat.id)
        categoryCount[cat.id] = dishesByCategory[cat.id].length
        selectedByCategory[cat.id] = dishes.filter(d => d.category === cat.id && d.selected).length
      })

      const selectedDishes = dishes.filter(d => d.selected)

      // 找到第一个有菜品的分类
      const firstCategory = categories.find(cat => categoryCount[cat.id] > 0)

      this.setData({
        dishes,
        allDishes: dishes,
        categories,
        dishesByCategory,
        categoryCount,
        selectedByCategory,
        selectedDishes,
        selectedCount: selectedDishes.length,
        currentCategory: firstCategory ? firstCategory.id : categories[0].id,
        loading: false,
        searchKey: ''
      })

      if (reorderIds.length > 0) {
        wx.showToast({ title: '已选好菜品~', icon: 'none' })
      }
    } catch (e) {
      console.error('加载菜品失败', e)
      this.setData({ loading: false })
    }
  },

  // 选择分类
  selectCategory(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      currentCategory: id,
      dishScrollId: `cat-${id}`
    })
  },

  // 搜索输入
  onSearchInput(e) {
    const searchKey = e.detail.value.trim()
    this.setData({ searchKey })
    this.filterDishes(searchKey)
  },

  // 清除搜索
  clearSearch() {
    this.setData({ searchKey: '' })
    this.filterDishes('')
  },

  // 过滤菜品
  filterDishes(searchKey) {
    const { allDishes, categories } = this.data
    let dishes = allDishes

    if (searchKey) {
      dishes = allDishes.filter(d => d.name.includes(searchKey) || (d.description && d.description.includes(searchKey)))
    }

    const dishesByCategory = {}
    const categoryCount = {}
    const selectedByCategory = {}

    categories.forEach(cat => {
      dishesByCategory[cat.id] = dishes.filter(d => d.category === cat.id)
      categoryCount[cat.id] = dishesByCategory[cat.id].length
      selectedByCategory[cat.id] = dishes.filter(d => d.category === cat.id && d.selected).length
    })

    const firstCategory = categories.find(cat => categoryCount[cat.id] > 0)

    this.setData({
      dishes,
      dishesByCategory,
      categoryCount,
      selectedByCategory,
      currentCategory: firstCategory ? firstCategory.id : categories[0].id
    })
  },

  // 监听右侧滚动，同步左侧高亮
  onDishScroll(e) {
    // 简化处理：不做滚动联动，只做点击联动
  },

  // 切换选中状态
  toggleSelect(e) {
    const id = e.currentTarget.dataset.id
    const dishes = this.data.dishes.map(item => {
      if (item._id === id) {
        return { ...item, selected: !item.selected }
      }
      return item
    })

    // 重新按分类整理
    const dishesByCategory = {}
    const selectedByCategory = {}
    this.data.categories.forEach(cat => {
      dishesByCategory[cat.id] = dishes.filter(d => d.category === cat.id)
      selectedByCategory[cat.id] = dishes.filter(d => d.category === cat.id && d.selected).length
    })

    const selectedDishes = dishes.filter(item => item.selected)

    this.setData({
      dishes,
      dishesByCategory,
      selectedByCategory,
      selectedDishes,
      selectedCount: selectedDishes.length
    })
  },

  // 切换购物车面板
  toggleCartPanel() {
    this.setData({ showCartPanel: !this.data.showCartPanel })
  },

  // 打开菜品详情面板
  openDishDetail(e) {
    const id = e.currentTarget.dataset.id
    const dish = this.data.dishes.find(d => d._id === id)
    if (dish) {
      this.setData({ showDishDetail: true, currentDish: dish })
    }
  },

  // 关闭菜品详情面板
  closeDishDetail() {
    this.setData({ detailClosing: true, detailTranslateY: 0 })
    setTimeout(() => {
      this.setData({ showDishDetail: false, detailClosing: false, currentDish: null })
    }, 300)
  },

  // 下拉关闭 - 触摸开始
  onDetailTouchStart(e) {
    this.touchStartY = e.touches[0].clientY
    this.isDragging = false
  },

  // 下拉关闭 - 触摸移动
  onDetailTouchMove(e) {
    const currentY = e.touches[0].clientY
    const deltaY = currentY - this.touchStartY
    if (deltaY > 0) {
      this.isDragging = true
      this.setData({ detailTranslateY: deltaY })
    }
  },

  // 下拉关闭 - 触摸结束
  onDetailTouchEnd() {
    const { detailTranslateY } = this.data
    if (detailTranslateY > 150) {
      this.closeDishDetail()
    } else {
      this.setData({ detailTranslateY: 0 })
    }
  },

  // 详情面板中切换选中状态
  toggleDishInDetail() {
    const { currentDish } = this.data
    if (!currentDish) return

    const dishes = this.data.dishes.map(item => {
      if (item._id === currentDish._id) {
        return { ...item, selected: !item.selected }
      }
      return item
    })

    const dishesByCategory = {}
    const selectedByCategory = {}
    this.data.categories.forEach(cat => {
      dishesByCategory[cat.id] = dishes.filter(d => d.category === cat.id)
      selectedByCategory[cat.id] = dishes.filter(d => d.category === cat.id && d.selected).length
    })

    const selectedDishes = dishes.filter(item => item.selected)
    const updatedDish = dishes.find(d => d._id === currentDish._id)

    this.setData({
      dishes,
      dishesByCategory,
      selectedByCategory,
      selectedDishes,
      selectedCount: selectedDishes.length,
      currentDish: updatedDish
    })
  },

  // 从购物车移除
  removeFromCart(e) {
    const id = e.currentTarget.dataset.id
    const dishes = this.data.dishes.map(item => {
      if (item._id === id) {
        return { ...item, selected: false }
      }
      return item
    })

    const dishesByCategory = {}
    const selectedByCategory = {}
    this.data.categories.forEach(cat => {
      dishesByCategory[cat.id] = dishes.filter(d => d.category === cat.id)
      selectedByCategory[cat.id] = dishes.filter(d => d.category === cat.id && d.selected).length
    })

    const selectedDishes = dishes.filter(item => item.selected)

    this.setData({
      dishes,
      dishesByCategory,
      selectedByCategory,
      selectedDishes,
      selectedCount: selectedDishes.length
    })
  },

  // 清空购物车
  clearCart() {
    const dishes = this.data.dishes.map(item => ({ ...item, selected: false }))

    const dishesByCategory = {}
    const selectedByCategory = {}
    this.data.categories.forEach(cat => {
      dishesByCategory[cat.id] = dishes.filter(d => d.category === cat.id)
      selectedByCategory[cat.id] = 0
    })

    this.setData({
      dishes,
      dishesByCategory,
      selectedByCategory,
      selectedDishes: [],
      selectedCount: 0,
      showCartPanel: false
    })
  },

  // 提交点菜 - 先弹出备注输入框
  submitOrder() {
    const { selectedDishes, submitting } = this.data

    if (submitting || selectedDishes.length === 0) {
      if (selectedDishes.length === 0) {
        wx.showToast({ title: '请先选择菜品', icon: 'none' })
      }
      return
    }

    // 弹出备注输入框
    this.setData({ showRemarkModal: true, remark: '' })
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  // 关闭备注弹窗
  closeRemarkModal() {
    this.setData({ showRemarkModal: false })
  },

  // 阻止冒泡
  preventClose() {},

  // 跳过备注
  skipRemark() {
    this.setData({ showRemarkModal: false })
    this.doSubmitOrder('')
  },

  // 确认备注
  confirmRemark() {
    this.setData({ showRemarkModal: false })
    this.doSubmitOrder(this.data.remark)
  },

  // 实际提交点菜
  async doSubmitOrder(remark) {
    const { selectedDishes } = this.data

    this.setData({ submitting: true })

    try {
      const db = await app.database()

      // 保存点菜记录
      await db.collection(app.globalData.collectionOrderList).add({
        data: {
          dishes: selectedDishes.map(item => ({
            _id: item._id,
            name: item.name,
            imageUrl: item.imageUrl || '',
            category: item.category
          })),
          remark,
          createTime: db.serverDate(),
        }
      })

      // 更新菜品点单次数
      const _ = db.command
      for (const dish of selectedDishes) {
        db.collection(app.globalData.collectionDishList).doc(dish._id).update({
          data: { orderCount: _.inc(1) }
        }).catch(() => {})
      }

      // 发送通知
      await this.sendNotification(selectedDishes, remark)

      // 显示成功弹窗
      this.setData({
        showSuccess: true,
        submitting: false
      })

    } catch (e) {
      console.error('点菜失败', e)
      wx.showToast({ title: '点菜失败，请重试', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  // 发送通知
  async sendNotification(dishes, remark) {
    const dishNames = dishes.map(d => d.name).join('、')
    try {
      await wx.cloud.callFunction({
        name: 'sendNotify',
        data: {
          type: 'newOrder',
          dishNames,
          count: dishes.length,
          remark
        }
      })
    } catch (e) {
      console.log('通知发送失败（可忽略）', e)
    }
  },

  // 关闭成功弹窗
  closeSuccess() {
    // 重置选择状态
    const dishes = this.data.dishes.map(item => ({
      ...item,
      selected: false
    }))

    const dishesByCategory = {}
    const selectedByCategory = {}
    this.data.categories.forEach(cat => {
      dishesByCategory[cat.id] = dishes.filter(d => d.category === cat.id)
      selectedByCategory[cat.id] = 0
    })

    this.setData({
      showSuccess: false,
      dishes,
      dishesByCategory,
      selectedByCategory,
      selectedDishes: [],
      selectedCount: 0
    })
  },

  // 跳转到菜品库
  goToDishes() {
    wx.switchTab({ url: '/pages/Dishes/index' })
  },
})
