const app = getApp()

Page({
  data: {
    isBound: false,
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
    app.setKitchenTitle()
    this.loadPartnerName()
    await app.loadCategories()
    this.loadDishes()
  },

  // 获取伴侣名字
  async loadPartnerName() {
    await app.loadUserInfo()
    const partnerName = app.getPartnerName()
    this.setData({ partnerName })
  },

  // 加载菜品
  async loadDishes() {
    this.setData({ loading: true })
    try {
      const res = await wx.cloud.callFunction({
        name: 'getCoupleData',
        data: {
          collection: app.globalData.collectionDishList,
          orderBy: 'createTime',
          order: 'desc',
          limit: 100
        }
      })
      if (!res.result?.success) {
        throw new Error(res.result?.message || '加载失败')
      }
      const data = res.result.data

      // 检查是否有再来一单的菜品
      const reorderIds = app.globalData.reorderDishIds ? app.globalData.reorderDishIds.split(',') : []
      app.globalData.reorderDishIds = null

      const dishes = data.map(item => ({
        ...item,
        selected: reorderIds.includes(item._id),
        category: item.category || 'meat'
      }))

      const categories = app.globalData.categories || []
      if (categories.length === 0) {
        console.warn('分类数据为空，请检查 manageCategory 云函数')
        this.setData({ dishes, allDishes: dishes, loading: false })
        return
      }

      const dishesByCategory = {}
      const categoryCount = {}
      const selectedByCategory = {}

      categories.forEach(cat => {
        dishesByCategory[cat._id] = dishes.filter(d => d.category === cat._id)
        categoryCount[cat._id] = dishesByCategory[cat._id].length
        selectedByCategory[cat._id] = dishes.filter(d => d.category === cat._id && d.selected).length
      })

      const selectedDishes = dishes.filter(d => d.selected)

      // 找到第一个有菜品的分类
      const firstCategory = categories.find(cat => categoryCount[cat._id] > 0)

      this.setData({
        dishes,
        allDishes: dishes,
        categories,
        dishesByCategory,
        categoryCount,
        selectedByCategory,
        selectedDishes,
        selectedCount: selectedDishes.length,
        currentCategory: firstCategory ? firstCategory._id : categories[0]._id,
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
      dishScrollId: `cat-${id}`,
      categoryScrollId: `catleft-${id}`
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
      dishesByCategory[cat._id] = dishes.filter(d => d.category === cat._id)
      categoryCount[cat._id] = dishesByCategory[cat._id].length
      selectedByCategory[cat._id] = dishes.filter(d => d.category === cat._id && d.selected).length
    })

    const firstCategory = categories.find(cat => categoryCount[cat._id] > 0)

    this.setData({
      dishes,
      dishesByCategory,
      categoryCount,
      selectedByCategory,
      currentCategory: firstCategory ? firstCategory._id : categories[0]._id
    })
  },

  // 监听右侧滚动，同步左侧高亮
  onDishScroll(e) {
    if (this._scrollTimer) return
    this._scrollTimer = setTimeout(() => {
      this._scrollTimer = null
      this._syncCategoryHighlight()
    }, 100)
  },

  _syncCategoryHighlight() {
    const visibleCats = this.data.categories.filter(c => this.data.categoryCount[c._id] > 0)
    if (visibleCats.length === 0) return

    const query = this.createSelectorQuery()
    query.select('.dish-list').boundingClientRect()
    visibleCats.forEach(cat => {
      query.select(`#cat-${cat._id}`).boundingClientRect()
    })
    query.exec(rects => {
      if (!rects || !rects[0]) return
      const listTop = rects[0].top + 20
      let activeId = visibleCats[0]._id
      for (let i = 0; i < visibleCats.length; i++) {
        if (rects[i + 1] && rects[i + 1].top <= listTop) {
          activeId = visibleCats[i]._id
        }
      }
      if (activeId !== this.data.currentCategory) {
        this.setData({
          currentCategory: activeId,
          categoryScrollId: `catleft-${activeId}`
        })
      }
    })
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
      dishesByCategory[cat._id] = dishes.filter(d => d.category === cat._id)
      selectedByCategory[cat._id] = dishes.filter(d => d.category === cat._id && d.selected).length
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
      dishesByCategory[cat._id] = dishes.filter(d => d.category === cat._id)
      selectedByCategory[cat._id] = dishes.filter(d => d.category === cat._id && d.selected).length
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
      dishesByCategory[cat._id] = dishes.filter(d => d.category === cat._id)
      selectedByCategory[cat._id] = dishes.filter(d => d.category === cat._id && d.selected).length
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
      dishesByCategory[cat._id] = dishes.filter(d => d.category === cat._id)
      selectedByCategory[cat._id] = 0
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
    let value = e.detail.value
    if (value.length > 100) value = value.slice(0, 100)
    this.setData({ remark: value })
    return value
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
    wx.requestSubscribeMessage({
      tmplIds: app.globalData.notifyTmplIds,
      complete: () => this.doSubmitOrder('')
    })
  },

  // 确认备注
  confirmRemark() {
    this.setData({ showRemarkModal: false })
    wx.requestSubscribeMessage({
      tmplIds: app.globalData.notifyTmplIds,
      complete: () => this.doSubmitOrder(this.data.remark)
    })
  },

  // 实际提交点菜
  async doSubmitOrder(remark) {
    if (!app.isBound()) {
      wx.showToast({ title: '请先绑定伴侣', icon: 'none' })
      return
    }

    const { selectedDishes } = this.data

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中...', mask: true })

    try {
      const db = await app.database()

      // 保存点菜记录（带上 coupleId）
      const coupleId = app.globalData.currentUser?.coupleId || ''
      const addRes = await db.collection(app.globalData.collectionOrderList).add({
        data: {
          dishes: selectedDishes.map(item => ({
            _id: item._id,
            name: item.name,
            imageUrl: item.imageUrl || '',
            category: item.category
          })),
          remark,
          coupleId,
          createTime: db.serverDate(),
        }
      })
      const orderId = addRes._id

      // 更新菜品点单次数（异步执行，不阻塞）
      for (const dish of selectedDishes) {
        wx.cloud.callFunction({
          name: 'updateCoupleData',
          data: {
            collection: app.globalData.collectionDishList,
            docId: dish._id,
            action: 'inc',
            data: { orderCount: 1 }
          }
        }).catch(() => {})
      }

      // 发送通知
      await this.sendNotification(selectedDishes, remark, orderId)

      wx.hideLoading()
      // 显示成功弹窗
      this.setData({
        showSuccess: true,
        submitting: false
      })

    } catch (e) {
      wx.hideLoading()
      console.error('点菜失败', e)
      wx.showToast({ title: '点菜失败，请重试', icon: 'none' })
      this.setData({ submitting: false })
    }
  },

  // 发送通知
  async sendNotification(dishes, remark, orderId) {
    const dishNames = dishes.map(d => d.name).join('、')
    try {
      await wx.cloud.callFunction({
        name: 'sendNotify',
        data: {
          type: 'newOrder',
          templateId: app.globalData.notifyTmplIds[0],
          dishNames,
          count: dishes.length,
          remark,
          orderId
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
      dishesByCategory[cat._id] = dishes.filter(d => d.category === cat._id)
      selectedByCategory[cat._id] = 0
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
