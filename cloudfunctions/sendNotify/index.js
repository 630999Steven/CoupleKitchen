// 云函数入口文件 - 发送订阅消息通知
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 配置：两个用户的openid
const CONFIG = {
  openidA: 'of98y3YO5xjP-jppRx4qe87U1pMA',  // 泡泡浴
  openidB: 'of98y3c3p8_AduHK7Y2Vx5xtUgIM',  // 荔荔
  templateId: 'lFy-3Kj2HTuid-KZDiBQMpKppVHAQsy7G3KargWX1GY'
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const currentOpenid = wxContext.OPENID

  const { type, dishNames, count, dishName, remark } = event

  // 确定要通知的目标用户（对方）
  let targetOpenid
  if (currentOpenid === CONFIG.openidA) {
    targetOpenid = CONFIG.openidB
  } else if (currentOpenid === CONFIG.openidB) {
    targetOpenid = CONFIG.openidA
  } else {
    return { success: false, message: '未知用户' }
  }

  try {
    let result

    // 根据通知类型发送不同消息
    if (type === 'newOrder') {
      result = await cloud.openapi.subscribeMessage.send({
        touser: targetOpenid,
        templateId: CONFIG.templateId,
        page: 'pages/OrderHistory/index',
        data: {
          time25: { value: formatTime(new Date()) },                    // 时间（精确到分钟）
          thing31: { value: '帕恰狗的小厨房' },                           // 任务名称（写死）
          thing2: { value: dishNames.substring(0, 20) },                // 提醒内容（菜名）
          thing11: { value: (remark || '快来看看今天吃什么~').substring(0, 20) }  // 备注
        }
      })
    } else if (type === 'newDish') {
      result = await cloud.openapi.subscribeMessage.send({
        touser: targetOpenid,
        templateId: CONFIG.templateId,
        page: 'pages/Dishes/index',
        data: {
          time25: { value: formatTime(new Date()) },                    // 时间
          thing31: { value: '帕恰狗的小厨房' },                           // 任务名称
          thing2: { value: dishName.substring(0, 20) },                 // 提醒内容（菜名）
          thing11: { value: '新菜品加入菜单啦~' }                         // 备注
        }
      })
    } else {
      return { success: false, message: '未知通知类型' }
    }

    console.log('发送成功', result)
    return { success: true, result }
  } catch (err) {
    console.error('发送失败', err)
    return { success: false, error: err }
  }
}

// 格式化时间（精确到分钟，北京时间 UTC+8）
function formatTime(date) {
  // 转换为北京时间
  const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const year = beijingTime.getUTCFullYear()
  const month = (beijingTime.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = beijingTime.getUTCDate().toString().padStart(2, '0')
  const hours = beijingTime.getUTCHours().toString().padStart(2, '0')
  const minutes = beijingTime.getUTCMinutes().toString().padStart(2, '0')
  return `${year}年${month}月${day}日 ${hours}:${minutes}`
}
