const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event) => {
  const { fileList } = event
  if (!fileList || fileList.length === 0) {
    return { success: false, message: '缺少文件列表' }
  }
  try {
    const result = await cloud.getTempFileURL({ fileList })
    return { success: true, fileList: result.fileList }
  } catch (e) {
    console.error('getTempFileURL error', e)
    return { success: false, message: '获取临时链接失败', error: e.message }
  }
}
