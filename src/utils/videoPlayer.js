/**
 *  @version v1.2.1
 *  @date 2024-04-26
 *  @desc 优化登录设计模式
 */
;(function () {
  window.dhPlayerControl = Object.assign(
    {
      videoWS: null,
      wsConnectCount: 0,
      wsSession: 0,
      windowState: '',
      videoList: {}, // 每次创建后，每个videoId 对应的数据类
      hwndList: {}, // 每次创建后对应的 {hwnd: videoId} 键值对
      callBackList: {},
      wsConnect: false,
      loginFlag: 'LOGIN_PENDING',
    },
    window.dhPlayerControl || {},
    {
      noCardPlayerFlag: false,
      DHPlayerVersion: '',
      pkgDHPlayerVerion: [2311300922], // 配套的插件版本号
      pluginLoginInfo: {},
      isPIframe: false,
      dhMessage: {
        // 错误码对应错误信息描述
        701: {
          code: 701,
          message: '当前正在对讲，无法打开音频',
          type: 'msg',
        },
        702: {
          code: 702,
          message: '当前设备正在对讲',
          type: 'msg',
        },
        703: {
          code: 703,
          message: '当前其他设备正在对讲',
          type: 'msg',
        },
        704: {
          code: 704,
          message: '抓图鉴权',
          type: 'option',
        },
        705: {
          code: 705,
          message: '本地录像下载鉴权',
          type: 'option',
        },
        706: {
          code: 706,
          message: '主/辅码流切换',
          type: 'option',
        },
      },
    }
  )
  //在Function的原型上自定义myBind()方法
  Function.prototype.myBind = function myBind(context) {
    //获取要操作的函数
    var _this = this
    //获取实参（context除外）
    var args = Array.prototype.slice.call(arguments, 1)

    //判断当前浏览器是否兼容bind()方法
    if ('bind' in Function.prototype) {
      //如果浏览器兼容bind()方法，则使用bind()方法，并返回bind()方法执行后的结果
      return _this.bind(context, args)
    }
    //如果不兼容bind()方法，则返回一个匿名函数
    return function () {
      _this.apply(context, args)
    }
  }

  if (!document.getElementsByClassName) {
    document.getElementsByClassName = function (className, element) {
      var children = (element || document).getElementsByTagName('*')
      var elements = new Array()
      for (var i = 0; i < children.length; i++) {
        var child = children[i]
        var classNames = child.className.split(' ')
        for (var j = 0; j < classNames.length; j++) {
          if (classNames[j] == className) {
            elements.push(child)
            break
          }
        }
      }
      return elements
    }
  }

  /**
   * 匹配插件上的版本信息
   * @param {*} param
   * @param {*} type
   * @returns Object 版本匹配信息
   */
  function getVersionInfo() {
    if (window.dhPlayerControl.pkgDHPlayerVerion.includes(window.dhPlayerControl.DHPlayerVersion)) {
      return {
        isEqual: true,
        code: 0,
        message: '创建成功',
      }
    }
    if (window.dhPlayerControl.pkgDHPlayerVerion[0] > window.dhPlayerControl.DHPlayerVersion) {
      return {
        isEqual: false,
        code: -1,
        message: '当前电脑上的插件版本过低,建议升级插件!',
      }
    }
    if (
      window.dhPlayerControl.pkgDHPlayerVerion[window.dhPlayerControl.pkgDHPlayerVerion.length - 1] <
      window.dhPlayerControl.DHPlayerVersion
    ) {
      return {
        isEqual: true,
        code: 1,
        message: '创建成功',
      }
    }
  }

  /**
   * 内部方法 封装请求参数
   * @param {*} param
   * @param {*} type 接口类型
   * @returns Object 请求参数
   */
  function getAjaxParam(param, type) {
    // 处理对讲参数
    let processTalkParam = function (param) {
      if (param.channelId) {
        let tempArr = param.channelId.split('$1$0$')
        !tempArr && (tempArr = param.channelId.split('$'))
        return tempArr
      } else {
        return [param.deviceCode, param.channelSeq]
      }
    }
    let obj = {
      // 实时预览参数
      real: {
        data: {
          channelId: param.channelId || '',
          streamType: Number(param.streamType) || 1, // 默认主码流
          dataType: Number(param.dataType) || 1, // 默认是视频
        },
      },
      // 对讲参数
      talk: {
        data: {
          audioBit: 16,
          sampleRate: 8000,
          audioType: 2,
          talkType: getTalkType(param.deviceType),
          deviceCode: processTalkParam(param)[0],
          channelSeq: processTalkParam(param)[1],
        },
      },
      // 停止对讲参数
      stopTalk: {
        data: {
          deviceCode: processTalkParam(param)[0],
          channelSeq: processTalkParam(param)[1],
          talkType: getTalkType(param.deviceType),
          session: param.session,
        },
      },
      // 通过时间录像回放参数
      playbackByTime: {
        clientType: 'WINPC',
        clientMac: '30:9c:23:79:40:08',
        clientPushId: '',
        project: 'PSDK',
        method: 'SS.Playback.StartPlaybackByTime',
        data: {
          nvrId: '',
          optional: '/admin/API/SS/Playback/StartPlaybackByTime',
          recordType: '0', // 录像类型：1=一般录像，2=报警录像
          recordSource: param.recordSource, // 录像来源：1=全部，2=设备，3=中心 4-统一云
          streamType: param.streamType || 0, // 码流类型： 0=所有码流，1=主码流，2=辅码流
          channelId: param.channelId,
          startTime: param.bBack === 0 ? param.currentPlayTime || param.startTime : param.startTime,
          endTime: param.bBack === 0 ? param.endTime : param.currentPlayTime || param.endTime,
        },
      },
      // 通过文件录像回放参数
      playbackByFile: {
        clientType: 'WINPC',
        clientMac: '30:9c:23:79:40:08',
        clientPushId: '',
        project: 'PSDK',
        method: 'SS.Playback.StartPlaybackByFile',
        data: {
          ssId: '1001',
          optional: '/evo-apigw/admin/API/SS/Playback/StartPlaybackByFile',
          startTime: param.bBack === 0 ? param.currentPlayTime : param.playStartTime,
          endTime: param.bBack === 0 ? param.playEndTime : param.currentPlayTime,
          fileName: '{fe69f729-9d4b-42d4-b6a0-56189aaa4e1e}',
          diskId: '1540852944-1540853395',
          nvrId: '',
          recordSource: param.recordSource,
          channelId: param.channelId,
          playbackMode: '0',
          streamId: '5875',
        },
      },
      // 查询录像参数
      queryRecord: {
        clientType: 'WINPC',
        clientMac: '30:9c:23:79:40:08',
        clientPushId: '',
        project: 'PSDK',
        method: 'SS.Record.QueryRecords',
        data: {
          cardNo: '',
          optional: '/admin/API/SS/Record/QueryRecords',
          diskPath: '',
          startIndex: '',
          streamType: param.streamType || 0, // 码流类型：0= 所有码流, 1=主码流, 2=辅码流
          recordType: '0', // 录像类型：0=全部，1=手动录像，2=报警录像，3=动态监测，4=视频丢失，5=视频遮挡，6=定时录像，7=全天候录像，8=文件录像转换
          recordSource: param.recordSource, // 录像来源：1=全部，2=设备，3=中心 4-统一云
          endIndex: '',
          startTime: param.startTime,
          endTime: param.endTime,
          channelId: param.channelId,
        },
      },
    }
    // 对应的窗口号
    obj[type].snum = param.snum
    return JSON.parse(JSON.stringify(obj[type]))
  }

  /**
   * 获取对讲类型
   * @param { Number } deviceType
   * @returns talkType 对讲类型  1-设备对讲 2-通道对讲
   * @desc 只有EVS{1}, NVS{3}，NVR{6}，smartNVR{14}[已弃用]，IVSS{43}能对通道进行对讲。
   */
  function getTalkType(deviceType) {
    let channelTalk = [1, 3, 6, 14, 43]
    if (channelTalk.includes(Number(deviceType))) {
      return 2
    }
    return 1
  }

  /**
   * 内部方法
   * @desc 判断当前dom是否被 visibility: hidden 或者 display: none
   * @param {*} data
   * @returns { Boolean } visible
   */
  function isDomVisible(el) {
    // var loopable = true,
    // visible = getComputedStyle(el).display != 'none' && getComputedStyle(el).visibility != 'hidden';
    // 代码保留，不删除，递归访问
    // while(loopable && visible) {
    //     el = el.parentNode;
    //     if(el && el != document.body) {;
    //         visible = getComputedStyle(el).display != 'none' && getComputedStyle(el).visibility != 'hidden';
    //     }else {
    //         loopable = false;
    //     }
    // }
    return (
      (el && (window.getComputedStyle(el).display != 'none' || window.getComputedStyle(el).visibility != 'hidden')) ||
      false
    )
  }

  /**
   * 内部方法
   * @desc rtsp路径拼接token
   * @param {Object} 接口返回的rtsp对象
   */
  function dealUrl(data) {
    let path = data.url
    let compareUrl = ''
    if (path.includes('|')) {
      path = path
        .split('|')
        .map((item) => {
          // 视频子系统兼容
          if (item.includes(window.location.hostname)) {
            compareUrl = item + (data.token ? '?token=' + data.token : '')
            return null
          }
          return item + (data.token ? '?token=' + data.token : '')
        })
        .filter((item) => item)
        .join('|')
      path = compareUrl ? compareUrl + '|' + path : path
      // 兼容视频子系统
    } else {
      path = path + (data.token ? '?token=' + data.token : '')
    }
    return path
  }

  /**
   * 内部方法
   * @desc 处理当前浏览器的缩放比例
   */
  function getWindowSize() {
    var width = window.dhPlayerControl.isPIframe ? this.setting.topInnerWidth : window.top.innerWidth,
      height = window.dhPlayerControl.isPIframe ? this.setting.topInnerHeight : window.top.innerHeight
    return {
      width: width,
      height: height,
    }
  }

  /**
   * 内部方法
   * @desc 获取当前浏览器最左侧距离主屏的位置
   */
  function getScreenX() {
    // 造个假数据,模拟客户端返回
    let screenInfo = window.osRatio || [1, 1] // [主屏的缩放比例， 副屏的缩放比例]
    let defaultScreenX = window.screenX
    let availX = window.screen.availLeft
    let x = 0
    if (availX <= 0) {
      // 不需要计算主屏的位置
      x = defaultScreenX >= -2 && defaultScreenX <= 9 ? 0 : defaultScreenX
      // availX === 0 ? 0 : 1  为 0 表示在主屏上面， 小于 0 表示在副屏上，所以获取的分辨率不同。
      x = x * screenInfo[availX === 0 ? 0 : 1]
    } else {
      // 需要计算主屏的位置
      let sideX = defaultScreenX - availX
      sideX = sideX >= -2 && sideX <= 9 ? 0 : sideX
      // 计算主屏和副屏的真实距离后相加，即为x
      x = availX * screenInfo[0] + sideX * screenInfo[1]
    }
    return x
  }
  /**
   * 内部方法
   * @desc 获取页面缩放比例
   */
  function detectZoom() {
    var ratio = 0,
      screen = window.screen,
      ua = navigator.userAgent.toLowerCase()
    if (window.devicePixelRatio !== undefined) {
      ratio = window.devicePixelRatio
    } else if (~ua.indexOf('msie')) {
      if (screen.deviceXDPI && screen.logicalXDPI) {
        ratio = screen.deviceXDPI / screen.logicalXDPI
      }
    } else if (window.outerWidth !== undefined && window.innerWidth !== undefined) {
      ratio = window.outerWidth / window.innerWidth
    }

    if (ratio) {
      ratio = Math.round(ratio * 100)
    }
    return ratio
  }

  function socketOpen() {
    window.dhPlayerControl.windowState = 'wsPending'
    if (typeof WebSocket === 'undefined') {
      this.setting.createError &&
        this.setting.createError({
          code: 1005,
          data: null,
          success: false,
          message: '您的浏览器不支持socket!',
        })
      return
    }
    window.dhPlayerControl.videoWS = new WebSocket('ws:127.0.0.1:8000')
    window.dhPlayerControl.videoWS.onopen = function () {
      window.dhPlayerControl.manualCloseWS = false
      window.dhPlayerControl.windowState = 'wsSuccess' // websocket连接成功
      heartbeat.call(this)
      let _isSupport = isSupport()
      for (let key in window.dhPlayerControl.videoList) {
        let currentThis = window.dhPlayerControl.videoList[key]
        currentThis.send({
          method: 'common.version',
          info: {},
        })
        if (_isSupport.success) {
          if (currentThis.setting.usePluginLogin) {
            currentThis.loginServer()
            window.dhPlayerControl.loginFlag = 'LOGIN_PENDING'
            let p = new Promise((resolve, reject) => {
              let interval = setInterval(() => {
                if (window.dhPlayerControl.loginFlag !== 'LOGIN_PENDING') {
                  clearInterval(interval)
                  resolve()
                }
              }, 300)
            })
            p.then(() => {
              currentThis.create()
              window.isResetConnect = currentThis.setting.isResetConnect
            })
          } else {
            currentThis.create()
            window.isResetConnect = currentThis.setting.isResetConnect
          }
        } else {
          currentThis.setting.createError(_isSupport)
        }
        break
      }
    }
    window.dhPlayerControl.videoWS.onmessage = socketMessage
    window.dhPlayerControl.videoWS.onclose = () => {
      window.dhPlayerControl.windowState = 'wsError' // websocket连接成功
      if (window.isResetConnect && !window.dhPlayerControl.manualCloseWS) {
        for (var key in window.dhPlayerControl.videoList) {
          var currentThis = window.dhPlayerControl.videoList[key]
          currentThis.setting.createError &&
            currentThis.setting.createError({
              code: 1003,
              data: null,
              message: '无法与播放器建立连接，正在尝试重连...',
              success: false,
            })
        }
        setTimeout(() => {
          window.dhPlayerControl.videoWS = null
          socketOpen()
        }, 3000)
      } else {
        for (var key in window.dhPlayerControl.videoList) {
          var currentThis = window.dhPlayerControl.videoList[key]
          currentThis.setting.createError &&
            currentThis.setting.createError({
              code: 1003,
              data: null,
              message: '无法与播放器建立连接',
              success: false,
            })
        }
      }
    }
  }

  /**
   * 内部方法
   * @desc 插件心跳，保活
   */
  function heartbeat() {
    var that = this
    clearInterval(window.wsHeart)
    window.wsHeart = setInterval(function () {
      that.send(
        JSON.stringify({
          method: 'common.heartbeat',
          info: {},
          id: window.dhPlayerControl.wsConnectCount++,
        })
      )
    }, 10 * 1000)
  }

  function dataURLtoBlob(dataurl) {
    var mime = 'image/jpeg',
      bstr = atob(dataurl),
      n = bstr.length,
      u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], {
      type: mime,
    })
  }
  function downloadFileByBase64(base64, name) {
    var myBlob = dataURLtoBlob(base64)
    var myUrl = URL.createObjectURL(myBlob)
    return myUrl
  }

  /**
   * 前端与插件链接成功后，接收插件返回的信息
   * @param {*} evt
   * @returns
   */
  function socketMessage(evt) {
    if (evt.data == null || evt.data == '') {
      return
    }
    window.dhPlayerControl.wsSession = (data && data.session) || window.dhPlayerControl.wsSession
    var data = JSON.parse(evt.data)
    if (
      data.method &&
      ![
        'window.osRatio',
        'video.window.clicked',
        'video.window.dbclicked',
        'video.division.change',
        'video.customDivision.change',
        'video.downloadFileSize',
        'video.download.mp4.result',
        'video.downloadByTime',
      ].includes(data.method)
    ) {
    }
    // 登录校验
    if (data.method === 'window.loginServer') {
      switch (data.info.code) {
        case 0:
        case 3:
          window.dhPlayerControl.loginFlag = 'LOGIN_PENDING'
          break
        case 1:
        case 2:
          window.dhPlayerControl.loginFlag = 'LOGIN_SUCCESS'
          break
        case 4:
          window.dhPlayerControl.loginFlag = 'LOGIN_ERROR'
        default:
          break
      }
    }
    if (data.method === 'window.loginServer.notify') {
      if (data.info.result === 0) {
        window.dhPlayerControl.loginFlag = 'LOGIN_SUCCESS'
      } else {
        window.dhPlayerControl.loginFlag = 'LOGIN_ERROR'
      }
    }
    // 赋值版本号信息
    if (data && data.data && data.data.ver) {
      window.dhPlayerControl.DHPlayerVersion = Number(data.data.ver)
    }
    // 获取屏幕分辨率
    if (data.method === 'window.osRatio') {
      window.osRatio = data.info.dpi
    }
    // 保证 hwnd 是 number 类型
    if (data.info && typeof data.info.hwnd === 'number') {
      var videoInfo = window.dhPlayerControl.videoList[window.dhPlayerControl.hwndList[data.info.hwnd]]
      var hwndInfo = videoInfo.setting
      if (typeof data.info.snum === 'number') {
        var channelInfo = hwndInfo.channelList.filter((item) => item.snum === data.info.snum)[0]
      }
      switch (data.method) {
        case 'window.message':
          hwndInfo.dhPlayerMessage &&
            hwndInfo.dhPlayerMessage(channelInfo, window.dhPlayerControl.dhMessage[data.info.eventCode])
          break
        case 'video.change.substream':
          if (channelInfo.byUrl) {
            return (
              hwndInfo.dhPlayerMessage &&
              hwndInfo.dhPlayerMessage(channelInfo, { ...window.dhPlayerControl.dhMessage[706], streamType: substream })
            )
          }
          channelInfo.streamType = Number(data.info.substream)
          videoInfo.startReal([channelInfo], { isSubStream: true })
          break
        case 'video.notifyrealmonitor':
          // 表示成功
          if (Number(data.info.result) === 0) {
            hwndInfo.realSuccess && hwndInfo.realSuccess(channelInfo, hwndInfo.channelList)
          }
          // 拉流失败
          if (Number(data.info.result) === 10704) {
            hwndInfo.realError && hwndInfo.realError(channelInfo, { code: 10704, message: '打开视频失败' })
          }
          // 拉流超时
          if (Number(data.info.result) === -405) {
            hwndInfo.realError && hwndInfo.realError(channelInfo, { code: 10705, message: '打开视频超时' })
          }
          videoInfo.setWindowDragEnable()
          break
        // 实时预览播放过程中的断线重连
        case 'video.reopenvideo':
          if (channelInfo.byUrl) {
            return hwndInfo.realError(channelInfo, { code: 204, message: '流异常断开，请重新连接~' })
          }
          data.info.count++
          videoInfo.startReal([channelInfo], { isReOpen: true, count: data.info.count++ })
          break
        case 'video.notifyplayback':
          // 表示成功
          if (Number(data.info.result) === 0) {
            hwndInfo.playbackSuccess && hwndInfo.playbackSuccess(channelInfo, hwndInfo.channelList)
          }
          videoInfo.setWindowDragEnable()
          break
        case 'web.seekRecord':
          hwndInfo.channelList.forEach((item, index) => {
            if (item.snum === data.info.snum) {
              // 非集成状态下，抛出回调
              if (item.byUrl) {
                hwndInfo.switchStartTime &&
                  hwndInfo.switchStartTime({
                    startTime: data.info.seekTime,
                    snum: data.info.snum,
                  })
                return
              }
              if (data.info.seekTime < item.startTime) {
                hwndInfo.playbackError &&
                  hwndInfo.playbackError(channelInfo, {
                    code: 201,
                    message: '当前时间不得小于开始时间',
                  })
                return
              }
              if (data.info.seekTime > item.endTime) {
                hwndInfo.playbackError &&
                  hwndInfo.playbackError(channelInfo, {
                    code: 201,
                    message: '当前时间不得大于结束时间',
                  })
                return
              }
              let currentIndex =
                item.records &&
                item.records.findIndex((r) => {
                  return Number(r.startTime) <= data.info.seekTime && Number(r.endTime) > data.info.seekTime
                })
              // 如果
              if (currentIndex >= 0) {
                item.currentIndex = currentIndex
                item.currentPlayTime = data.info.seekTime
                item.bBack = Number(data.info.bBack)
                videoInfo.closeVideo(data.info.snum).then((res) => {
                  videoInfo.startPlayback(item, {
                    isConnect: true,
                    scaleSteps: Number(data.info.scaleSteps),
                  })
                })
              }
            }
          })
          break
        case 'web.replay':
          hwndInfo.channelList.forEach((item, index) => {
            if (item.snum === data.info.snum) {
              // 非集成状态下
              if (item.byUrl) {
                hwndInfo.replay && hwndInfo.replay(data.info.snum, data.info.seekTime)
                return
              }
              item.bBack = Number(data.info.bBack)
              if (!item.bBack) {
                if (item.currentIndex === item.records.length - 1) {
                  hwndInfo.playbackFinish &&
                    hwndInfo.playbackFinish({
                      snum: data.info.snum,
                      channelId: data.info.channelId,
                      code: 201,
                      message: '录像已全部播放完成',
                    })
                  // videoInfo.closeVideo(data.info.snum)
                  // hwndInfo.channelList.splice(index, 1)
                  return
                }
                item.currentIndex++
                item.currentPlayTime = item.records[item.currentIndex].startTime
              } else {
                if (item.currentIndex === 0) {
                  hwndInfo.playbackFinish &&
                    hwndInfo.playbackFinish({
                      snum: data.info.snum,
                      channelId: data.info.channelId,
                      code: 201,
                      message: '录像已全部播放完成',
                    })
                  // videoInfo.closeVideo(data.info.snum)
                  // hwndInfo.channelList.splice(index, 1)
                  return
                }
                item.currentIndex--
                item.currentPlayTime = item.records[item.currentIndex].endTime
              }
              if (item.recordSource === 2) {
                // 设备录像要关闭一次视频
                videoInfo.closeVideo(data.info.snum).then(() => {
                  videoInfo.startPlayback(item, {
                    isConnect: true,
                    scaleSteps: Number(data.info.scaleSteps),
                  })
                })
              } else {
                // 中心录像不需要
                videoInfo.startPlayback(item, {
                  isConnect: true,
                  bContinue: true,
                  scaleSteps: Number(data.info.scaleSteps),
                })
              }
            }
          })
          break
        case 'video.close':
          let i = -1
          hwndInfo.channelList.forEach((item, index) => {
            // 获取到要被删除的数据 (插件内部关闭且存在窗口统一)
            if (item.snum === data.info.snum) {
              if (!item.closed) {
                i = index
              } else {
                delete item.closed
              }
            }
          })
          if (i >= 0) {
            hwndInfo.channelList.splice(i, 1)
            // 删除掉窗口和channelId都匹配上的
            hwndInfo.closeWindowSuccess &&
              hwndInfo.closeWindowSuccess({
                snum: data.info.snum,
                channelList: hwndInfo.channelList,
              })
          }
          break
        case 'video.notifytalk':
          // 判断是否有对讲
          if (data.info.bOpen) {
            let talkFlag = false
            hwndInfo.channelList.forEach((item) => {
              if (item.byUrl) {
                talkFlag = true
                // 告诉前端传入url对讲回调
                hwndInfo.notifyTalk && hwndInfo.notifyTalk({ channelId: data.info.channelId, snum: data.info.snum })
                return
              }
              if (item.isTalk) {
                talkFlag = true
                hwndInfo.request.stopTalk &&
                  hwndInfo.request
                    .stopTalk(getAjaxParam(item, 'stopTalk'))
                    .then(() => {
                      delete item.isTalk
                      videoInfo.startTalk(data.info.snum)
                    })
                    .catch((err) => {
                      // 表示当前不存在
                      if (err.code === 2051) {
                        videoInfo.startTalk(data.info.snum)
                      }
                    })
              }
            })
            !talkFlag && videoInfo.startTalk(data.info.snum)
          } else {
            hwndInfo.channelList.forEach((item) => {
              if (item.snum === data.info.snum) {
                hwndInfo.request.stopTalk &&
                  hwndInfo.request.stopTalk(getAjaxParam(item, 'stopTalk')).then(() => {})
              }
              videoInfo.closeTalk()
            })
          }
          break
        case 'talk.close':
          hwndInfo.snum = data.info.wndId
          hwndInfo.closeTalkSuccess && hwndInfo.closeTalkSuccess(data.info.wndId)
          break
        case 'web.captureCallBack':
          var imageUrl = data.info.PicBuf ? downloadFileByBase64(data.info.PicBuf) : ''
          hwndInfo.snapshotSuccess &&
            hwndInfo.snapshotSuccess(
              {
                base64Url: data.info.PicBuf,
                path: imageUrl,
              },
              channelInfo
            )
          break
        case 'window.LocalRecordFinish':
          hwndInfo.videoDownloadSuccess && hwndInfo.videoDownloadSuccess(data.info.path, channelInfo)
          break
        case 'video.window.clicked':
          channelInfo = hwndInfo.channelList.filter((item) => item.snum === data.info.wndIndex)[0]
          hwndInfo.clickWindow && hwndInfo.clickWindow(data.info.wndIndex, channelInfo)
          break
        case 'video.window.dbclicked':
          channelInfo = hwndInfo.channelList.filter((item) => item.snum === data.info.wndIndex)[0]
          hwndInfo.dbClickWindow && hwndInfo.dbClickWindow(data.info.wndIndex, channelInfo)
          break
        case 'video.division.change':
          hwndInfo.division = data.info.division
          hwndInfo.changeDivision && hwndInfo.changeDivision(data.info.division)
          videoInfo.setWindowDragEnable()
          break
        case 'video.customDivision.change':
          hwndInfo.division = JSON.stringify(data.info)
          hwndInfo.changeDivision && hwndInfo.changeDivision(JSON.stringify(data.info))
          videoInfo.setWindowDragEnable()
          break
        case 'video.downloadFileSize':
          hwndInfo.downloadProgress && hwndInfo.downloadProgress(data.info)
          break
        case 'video.download.mp4.result':
          hwndInfo.downloadRecordSuccess && hwndInfo.downloadRecordSuccess(data.info)
          break
        case 'video.downloadByTime':
          if (Number(data.info.errCode) === 0) {
            hwndInfo.downloadRecordSuccess && hwndInfo.downloadRecordSuccess(data.info)
          } else {
            let errMessage = {
              142: 'rtsp断开连接',
              135: '视频异常',
              141: 'SS服务异常',
            }
            hwndInfo.downloadRecordError &&
              hwndInfo.downloadRecordError(data.info, {
                code: Number(data.info.errCode),
                mesage: errMessage[Number(data.info.errCode)],
              })
          }
        default:
          break
      }
    }
    var onError = null
    var onSuccess = null
    if (window.dhPlayerControl.callBackList[data['id']]) {
      onError = window.dhPlayerControl.callBackList[data['id']].onError
      onSuccess = window.dhPlayerControl.callBackList[data['id']].onSuccess
    }
    if (data.code != 0) {
      if (onError && typeof onError === 'function') {
        onError(data)
        delete window.dhPlayerControl.callBackList[data['id']]
      }
      return
    }
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(data)
      delete window.dhPlayerControl.callBackList[data['id']]
    }
  }
  //主动关闭socket
  function socketClose() {
    window.dhPlayerControl.manualCloseWS = true
    window.dhPlayerControl.videoWS && window.dhPlayerControl.videoWS.close()
    window.dhPlayerControl.videoWS = null
    window.wsHeart = clearInterval(window.wsHeart)
  }

  /**
   * @desc 获取操作系统
   */
  function getOsInfo() {
    var userAgent = window.navigator.userAgent.toLowerCase()
    var version = ''
    if (userAgent.indexOf('win') > -1) {
      if (userAgent.indexOf('windows nt 5.0') > -1 || userAgent.indexOf('Windows 2000') > -1) {
        version = 'Windows 2000'
      } else if (userAgent.indexOf('windows nt 5.1') > -1 || userAgent.indexOf('Windows XP') > -1) {
        version = 'Windows XP'
      } else if (userAgent.indexOf('windows nt 5.2') > -1 || userAgent.indexOf('Windows 2003') > -1) {
        version = 'Windows 2003'
      } else if (userAgent.indexOf('windows nt 6.0') > -1 || userAgent.indexOf('Windows Vista') > -1) {
        version = 'Windows Vista'
      } else if (userAgent.indexOf('windows nt 6.1') > -1 || userAgent.indexOf('windows 7') > -1) {
        version = 'Windows 7'
      } else if (userAgent.indexOf('windows nt 6.2') > -1 || userAgent.indexOf('windows 8') > -1) {
        version = 'Windows 8'
      } else if (userAgent.indexOf('windows nt 6.3') > -1) {
        version = 'Windows 8.1'
      } else if (userAgent.indexOf('windows nt 6.4') > -1 || userAgent.indexOf('windows nt 10') > -1) {
        version = 'Windows 10'
      } else {
        version = 'Unknown'
      }
    } else if (userAgent.indexOf('iphone') > -1) {
      version = 'Iphone'
    } else if (userAgent.indexOf('mac') > -1) {
      version = 'Mac'
    } else if (
      userAgent.indexOf('x11') > -1 ||
      userAgent.indexOf('unix') > -1 ||
      userAgent.indexOf('sunname') > -1 ||
      userAgent.indexOf('bsd') > -1
    ) {
      version = 'Unix'
    } else if (userAgent.indexOf('linux') > -1) {
      if (userAgent.indexOf('android') > -1) {
        version = 'Android'
      } else {
        version = 'Linux'
      }
    } else {
      version = 'Unknown'
    }
    return version
  }

  /**
   * @desc 获取浏览器和对应浏览器版本
   */
  function getBroswerVersion() {
    // 浏览器判断和版本号读取
    var Sys = {}
    var userAgent = navigator.userAgent.toLowerCase()
    var s
    ;(s = userAgent.match(/edg\/([\d.]+)/))
      ? (Sys.edge = s[1])
      : (s = userAgent.match(/rv:([\d.]+)\) like gecko/))
      ? (Sys.ie = s[1])
      : (s = userAgent.match(/msie ([\d.]+)/))
      ? (Sys.ie = s[1])
      : (s = userAgent.match(/firefox\/([\d.]+)/))
      ? (Sys.firefox = s[1])
      : (s = userAgent.match(/chrome\/([\d.]+)/))
      ? (Sys.chrome = s[1])
      : (s = userAgent.match(/opera.([\d.]+)/))
      ? (Sys.opera = s[1])
      : (s = userAgent.match(/version\/([\d.]+).*safari/))
      ? (Sys.safari = s[1])
      : 0

    if (Sys.edge)
      return {
        broswer: 'Edg',
        version: Sys.edge,
      }
    if (Sys.ie)
      return {
        broswer: 'IE',
        version: Sys.ie,
      }
    if (Sys.firefox)
      return {
        broswer: 'Firefox',
        version: Sys.firefox,
      }
    if (Sys.chrome)
      return {
        broswer: 'Chrome',
        version: Sys.chrome,
      }
    if (Sys.opera)
      return {
        broswer: 'Opera',
        version: Sys.opera,
      }
    if (Sys.safari)
      return {
        broswer: 'Safari',
        version: Sys.safari,
      }

    return {
      broswer: '',
      version: '0',
    }
  }

  function broswerInfo() {
    var _version = getBroswerVersion()
    if (_version.broswer === 'IE') {
      return 0
    } else if (_version.broswer === 'Chrome' || _version.broswer === 'Edg') {
      return 1
    } else if (_version.broswer === 'Firefox') {
      return 2
    } else {
      return -1
    }
  }

  /**
   * 内部方法
   * @desc 判断当前操作系统和浏览器版本类型是否支持DHPlayer
   */
  function isSupport() {
    let supportedOS = ['Windows 7', 'Windows 10', 'Windows 8', 'Windows 8.1', 'Unix', 'Linux']
    let supportedBroswer = ['Chrome', 'Firefox', 'Edg']
    let osVersion = getOsInfo()
    let { broswer, version } = getBroswerVersion()
    if (!supportedOS.includes(osVersion)) {
      return {
        code: 1002,
        success: false,
        message: '电脑系统不支持！仅支持win7, win8, win8.1, win10, Unix, Linux 系统',
      }
    }
    if (!supportedBroswer.includes(broswer)) {
      return {
        code: 1002,
        success: false,
        message: '当前浏览器不支持！ 仅支持谷歌，火狐，edge浏览器',
      }
    }
    if (Number(version.split('.')[0]) < 76 || osVersion === 'unix') {
      return {
        code: 1002,
        success: false,
        message: '当前的浏览器版本不支持！请使用较高版本的浏览器！',
      }
    }
    return {
      code: 1000,
      success: true,
    }
  }

  // 获取iframe的位置
  function getIframeRect(name) {
    var outLeft = 0
    var outTop = 0
    var pOutContent
    if (window.dhPlayerControl.isPIframe) {
      pOutContent = this.setting.pIframeRect
      outLeft = pOutContent.left || 0
      outTop = pOutContent.top || 0
    } else {
      // 表示顶层window
      if (window.parent !== window) {
        return {
          outLeft: 0,
          outTop: 0,
        }
      }
      var iframes = window.parent.document.getElementsByTagName('iframe')
      var pIframe = null
      var dom = ''
      let getpIframe = (index) => {
        if (!iframes[index]) return
        try {
          if (name) {
            dom = iframes[index].contentWindow.document.getElementsByClassName(name)[0]
          } else {
            dom = iframes[index].contentWindow.document.getElementById(this.setting.videoId)
          }
          if (dom) {
            pIframe = iframes[index]
          } else {
            getpIframe(index + 1)
          }
        } catch (err) {
          getpIframe(index + 1)
        }
      }
      iframes.length && getpIframe(0)
      if (pIframe) {
        pOutContent = pIframe.getBoundingClientRect()
        outLeft = pOutContent.left
        outTop = pOutContent.top
      }
    }
    return {
      outLeft,
      outTop,
    }
  }

  // 获取遮挡的位置数据
  function computedRect(className, isIframe) {
    let doms = null
    let { outLeft, outTop } = getIframeRect.call(this)
    if (isIframe) {
      outLeft = 0
      outTop = 0
    }
    // 处理dom的位置数据
    let processDoms = (doms) => {
      let rectArr = []
      doms.length &&
        doms.forEach((item) => {
          let rect = (item && item.getBoundingClientRect()) || null
          if (rect && (rect.width || rect.height)) {
            rectArr = [
              ...rectArr,
              rect.left + (this.setting.outContent.left || outLeft),
              rect.top + (this.setting.outContent.top || outTop),
              rect.width,
              rect.height,
            ]
          }
        })
      return rectArr
    }
    if (isIframe) {
      doms = window.top.document.querySelectorAll(`.${className}`)
    } else {
      doms = window.document.querySelectorAll(`.${className}`)
    }
    return processDoms(doms)
  }

  // 获取位置
  function getRect(name) {
    var el = ''
    var videoId = this.setting.videoId
    if (name) {
      el = document.getElementsByClassName(name)[0]
    } else {
      el = document.getElementById(videoId)
    }
    if (!el) {
      return {}
    }
    var rect = el.getBoundingClientRect()
    var { outTop, outLeft } = getIframeRect.call(this, name)
    var left = rect.left + (this.setting.outContent.left || outLeft)
    var top = rect.top + (this.setting.outContent.top || outTop)
    var right = left + rect.width
    var bottom = top + rect.height
    return {
      left,
      top,
      right,
      bottom,
      width: rect.width,
      height: rect.height,
    }
  }
  // 请求录像文件信息
  function queryRecord(param, type = 'queryRecord') {
    return new Promise((resolve, reject) => {
      // 查询录像
      if (param.records && param.records.length) {
        resolve(param)
      }
      if (!this.setting.request[type]) {
        reject({
          code: 207,
          message: '请通过 request 属性传入查询录像接口',
        })
        return
      }
      this.setting.request[type](getAjaxParam(param, type))
        .then((res) => {
          if (!param.records || param.records === []) {
            if (!res.records || !res.records.length) {
              reject({
                code: 201,
                message: `通道 ${param.channelName || param.name || '未知'} 未查询到录像文件`,
              })
              return
            }
            param.records = res.records.sort((a, b) => a.startTime - b.startTime)
            param.currentIndex = 0
            this.setting.channelList[
              this.setting.channelList.findIndex(
                (item) => item.channelId === param.channelId && item.snum === param.snum
              )
            ] = param
          }
          resolve(res)
        })
        .catch((err) => {
          reject(err)
        })
    })
  }
  // 处理获取过来的rtsp流
  function processRtsp(data, param) {
    // 内外网环境会有多个rtspUrl
    data.records = param.records
    data.rtspUrl = dealUrl(data)
    return data
  }

  /**
   * 根据文件获取流
   * @param {*} param
   */
  function getPlayBackRtspByFile(param, isConnect, type = 'playbackByFile') {
    let that = this
    return new Promise((resolve, reject) => {
      let byFileParam = getAjaxParam(param, type)
      queryRecord
        .call(this, param)
        .then((res) => {
          if (!that.setting.request[type]) {
            reject({
              code: 207,
              message: '请通过 request 属性传入 “根据时间查询录像” 接口',
            })
            return
          }
          let records = res.records[param.currentIndex]
          // let rec = records[0]
          param.playStartTime = records.startTime
          param.playEndTime = records.endTime
          param.currentPlayTime = isConnect ? param.currentPlayTime : param.playStartTime
          let sTime = String(param.playStartTime)
          let eTime = String(param.playEndTime)
          byFileParam.data = {
            ssId: records.ssId,
            optional: '/evo-apigw/admin/API/SS/Playback/StartPlaybackByFile',
            startTime: sTime,
            endTime: eTime,
            fileName: records.recordName,
            diskId: `${sTime}-${eTime}`,
            nvrId: '',
            recordSource: param.recordSource,
            channelId: param.channelId,
            playbackMode: '0',
            streamId: records.streamId,
          }
          that.setting.request[type](byFileParam)
            .then((res) => {
              resolve(processRtsp(res, param))
            })
            .catch((err) => {
              reject(err)
            })
        })
        .catch((err) => {
          reject(err)
        })
    })
  }

  /**
   * 根据时间获取流
   * @param {*} option
   * @returns
   */
  function getPlayBackRtspByTime(param, type = 'playbackByTime') {
    // 设备录像也需要去查询当日有录像的时间段
    return new Promise((resolve, reject) => {
      queryRecord
        .call(this, param)
        .then(() => {
          if (!this.setting.request[type]) {
            reject({
              code: 207,
              message: '请通过 request 属性传入 “通过时间播放录像” 接口',
            })
            return
          }
          this.setting.request[type](getAjaxParam(param, type))
            .then((res) => {
              resolve(processRtsp(res, param))
            })
            .catch((err) => {
              reject(err)
            })
        })
        .catch((err) => {
          reject(err)
        })
    })
  }
  var VideoPlayer = function (option) {
    if (!option) {
      throw new Error('请传入配置参数')
    }
    if (this instanceof VideoPlayer) {
      var _setting = {
        isResetConnect: true, // websocket连接断开时，是否自动重新连接， true表示是， false表示否
        // isIE: !!window.ActiveXObject || 'ActiveXObject' in window, //判断是否为IE
        videoId: 'DHVideoPlayer',
        windowType: 0, // 0-实时预览，3-录像回放，7-录像回放(支持倒放)
        outContent: {
          left: 0,
          right: 0,
          width: 0,
          height: 0,
        },
        show: true, //当前窗口显示状态，隐藏：false，显示：true
        option_id: {},
        refreshTimer: null,
        browserType: 1,
        version: 0,
        stopRefresh: false, //停止一直刷新
        showBar: true, //是否显示下方控制栏。 true: 显示， false：隐藏
        hwnd: '', //窗口句柄
        division: 1, //子窗口数
        pIframeShieldData: [], // 跨域iframe下的遮挡信息
        documentTitle: '', // iframe模式下，需要获取到顶层的top，防止位置聚焦时发生偏移
        topInnerWidth: 0, // iframe模式下的顶层宽度
        topInnerHeight: 0, // iframe模式下的顶层高度
        parentIframeShieldRect: [], // iframe模式下遮罩的数据信息
        pIframeRect: [], // iframe模式下 iframe的数据信息
        topMozInnerScreenX: 0, // iframe模式下 火狐需要的数据信息
        topMozInnerScreenY: 0, // iframe模式下 火狐需要的数据信息
        oldPosition: '', // 存储循环数据中的上次位置数据
        oldShield: '', // 存储循环数据中的上次遮挡数据
        request: {}, // 存储请求
        channelList: [], // 存储当前播放器正在播放的视频
        draggable: false, // 是否支持拖拽，默认不支持
        visible: true, // 控制播放器的显示和隐藏
        domVisible: true, // 当前挂载的 dom 元素是否 true-显示/ false-隐藏, 默认true
        usePluginLogin: false, // 是否插件内部鉴权
        pluginLoginInfo: {
          // 插件登录信息
          host: '',
          port: '' || '443',
          username: '',
          password: '',
        },
      }
      this.setting = Object.assign({}, _setting, option)
      this.adjustCount = 0
      this.focus = false
      this.init()
    } else {
      return new VideoPlayer(option)
    }
  }
  VideoPlayer.fn = VideoPlayer.prototype = {
    // 浏览器关闭或者刷新
    onbeforeunload: function () {
      this.destroy(true).then(() => {
        socketClose.call(this)
      })
    },
    // 改变setting的参数值
    _update(param) {
      let paramType = (value, type) => Object.prototype.toString.call(value).includes(type)
      let {
        windowType,
        isResetConnect,
        request,
        division,
        visible,
        draggable,
        showBar,
        shieldClass,
        coverShieldClass,
        parentIframeShieldClass,
      } = param
      // 断线重连 (不对外开放，默认支持断线重连)
      paramType(isResetConnect, 'Boolean') &&
        !(isResetConnect === this.setting.isResetConnect) &&
        (this.setting.isResetConnect = isResetConnect)
      // 显隐播放器
      paramType(visible, 'Boolean') &&
        !(visible === this.setting.visible) &&
        ((this.setting.visible = visible), visible ? this.show() : this.hide())
      // 显影控制栏
      paramType(showBar, 'Boolean') && !(showBar === this.setting.showBar) && this.showControlBar(showBar)
      // 播放器是否支持拖拽
      paramType(draggable, 'Boolean') &&
        !(draggable === this.setting.draggable) &&
        ((this.setting.draggable = draggable), this.setWindowDragEnable())
      // 窗口分割
      !(division == this.setting.division) && this.changeDivision(division)
      // 接口转换
      paramType(request, 'Object') && (this.setting.request = { ...request })
      // 遮挡类的改变
      paramType(shieldClass, 'Array') && (this.setting.shieldClass = shieldClass)
      paramType(parentIframeShieldClass, 'Array') && (this.setting.parentIframeShieldClass = parentIframeShieldClass)
      paramType(coverShieldClass, 'Array') && (this.setting.coverShieldClass = coverShieldClass)
      // 重新创建
      windowType = Number(windowType)
      if ([0, 1, 2, 3, 7].includes(windowType) && windowType !== Number(this.setting.windowType)) {
        if (this.setting.socketTimer) {
          clearTimeout(this.setting.socketTimer)
        }
        this.setting.socketTimer = setTimeout(
          () => {
            this.setting.windowType = windowType
            this.create()
          },
          this.setting.usePluginLogin ? 1000 : 300
        )
      }
    },
    //发送消息
    send: function (option, callBack) {
      option.session = window.dhPlayerControl.wsSession
      option.id = window.dhPlayerControl.wsConnectCount++
      if (option.info) {
        option.info.browserType = this.setting.browserType
        if (option.method !== 'window.destroy') {
          option.info.hwnd = option.method === 'window.create' ? undefined : this.setting.hwnd
        }
      }
      if (callBack && Object.keys(callBack).length) {
        window.dhPlayerControl.callBackList[option['id']] = callBack
      }
      window.dhPlayerControl.videoWS &&
        window.dhPlayerControl.videoWS.readyState == 1 &&
        window.dhPlayerControl.videoWS.send(JSON.stringify(option))
    },

    // 创建视频窗口
    create: function () {
      var rect = getRect.call(this)
      var _info = Object.assign({}, {}, rect)
      var windowSize = getWindowSize.call(this)
      var zoom = detectZoom()
      _info.isCustomDivision = isNaN(this.setting.division)
      _info.num = isNaN(this.setting.division) ? null : this.setting.division // 窗口数量
      _info.customDivision = isNaN(this.setting.division) ? JSON.parse(this.setting.division) : null
      _info.toolBar = this.setting.showBar ? 1 : 0 // 是否显示控制栏
      _info.windowType = this.setting.windowType - 0 // 判断当前为实时预览还是录像回放 0-实时预览  3-录像回放
      _info.clientAreaHeight = (windowSize.height * zoom) / 100
      _info.clientAreaWidth = (windowSize.width * zoom) / 100
      _info.authority = false // 操作栏上的按钮是否走权限判断(兼容视频子系统，需要传true，对外false)
      this.setTopBind = this.setTop.myBind(this)
      this.onbeforeunloadBind = this.onbeforeunload.myBind(this)
      this.visibilitychangeBind = this.setVisible.myBind(this)
      var that = this
      this.destroy().then(() => {
        this.send(
          {
            method: 'window.create',
            info: _info,
          },
          {
            onSuccess: function (data) {
              if (data.data && typeof data.data.hwnd === 'number') {
                var hwnd = data.data.hwnd
                that.setting.hwnd = hwnd
                window.dhPlayerControl.videoList[that.setting.videoId].setting = that.setting
                window.dhPlayerControl.hwndList[hwnd] = that.setting.videoId
              }
              that.setTopBind = that.setTop.myBind(that)
              window.addEventListener('beforeunload', that.onbeforeunloadBind)
              document.addEventListener('click', that.setTopBind)
              that.handleAdjust()
              let i = 0
              while (i <= 3) {
                that.setting.oldPosition = ''
                that.setting.oldShield = ''
                that.changePosition()
                i++
              }
              that.setTabControlBtn()
              that.setWindowDragEnable()
              // 是否是插件内部鉴权，是的话则先登录
              if (that.setting.usePluginLogin) {
                if (window.dhPlayerControl.loginFlag === 'LOGIN_SUCCESS') {
                  that.setting.createSuccess && that.setting.createSuccess(getVersionInfo())
                } else if (window.dhPlayerControl.loginFlag === 'LOGIN_ERROR') {
                  that.setting.createError &&
                    that.setting.createError({
                      code: 1004,
                      msg: '登录失败, 请检查登录信息',
                    })
                }
              } else {
                that.setting.createSuccess && that.setting.createSuccess(getVersionInfo())
              }
              // 初始化的时候手动调用show方法，避免出现播放器不显示的问题
              // 前提条件： 保证在当前页面上时触发，否则不触发。
              document.visibilityState === 'visible' ? that.show() : that.hide()
              document.addEventListener('visibilitychange', that.visibilitychangeBind, true)
            },
            onError: function () {
              // 断开连接
              socketClose()
              // 重连
              let socketTimer = setTimeout(() => {
                socketOpen()
                clearTimeout(socketTimer)
              }, 3000)
              // that.setting.createError && that.setting.createError({
              //     code: 1006,
              //     data: null,
              //     message: '插件创建失败，刷新重试',
              //     success: false
              // })
            },
          }
        )
      })
    },
    // 设置播放器上方的操作按
    setTabControlBtn(btnList, snum) {
      // let showBtn = ["BTN_STREAM", "BTN_PTZ", "BTN_QUICKPLAY", "BTN_VOICE", "BTN_TALK", "BTN_RECORD", "BTN_PIC", "BTN_ENLARGE", "BTN_CLOSE"]
      let showBtn = ['BTN_STREAM', 'BTN_VOICE', 'BTN_TALK', 'BTN_RECORD', 'BTN_PIC', 'BTN_ENLARGE', 'BTN_CLOSE']
      this.send({
        method: 'video.toolbar.showButton',
        info: {
          space: 15,
          snum,
          btns: btnList || showBtn,
        },
      })
    },
    // 判断当前浏览器是否在tab页面上
    setVisible() {
      document.visibilityState == 'hidden' ? this.hide() : this.show()
    },
    //页面聚焦
    setTop() {
      this.focus = true
      document.visibilityState == 'visible' && this.browserFocusBlur()
    },
    browserFocusBlur: function () {
      this.send({
        method: 'browserFocusBlur',
        info: {
          show: this.setting.show,
          focus: this.focus,
        },
      })
    },
    //刷新窗口位置
    handleAdjust: function () {
      var _this = this
      // 每帧执行一次，减少DHplayer延时
      !this.setting.stopRefresh && this.changePosition()
      !this.setting.stopRefresh && this.windowShield(this.cover())

      // 实时判断 dom 元素是否可见
      let el = document.getElementById(this.setting.videoId)
      if (this.setting.domVisible !== isDomVisible(el)) {
        this.setting.domVisible ? this.hide() : this.show()
        this.setting.domVisible = isDomVisible(el)
      }
      this.setting.refreshTimer = window.requestAnimationFrame(function () {
        return _this.handleAdjust()
      })
    },
    removeClickEventListener: function () {
      document.removeEventListener('click', this.setTopBind)
    },
    addClickEventListener: function () {
      document.addEventListener('click', this.setTopBind)
    },
    /**
     * 销毁当前播放器
     * @param isRefresh 表示页面刷新或者关闭情况
     * @return Promise对象
     */
    destroy: function (isRefresh = false) {
      return new Promise((resolve, reject) => {
        let that = window.dhPlayerControl.videoList[this.setting.videoId]
        if (!that || (that.setting && typeof that.setting.hwnd !== 'number')) {
          resolve()
        } else {
          this.send(
            {
              method: 'window.destroy',
              info: {
                hwnd: that.setting.hwnd,
                isRefresh,
              },
            },
            {
              onSuccess: () => {
                document.removeEventListener('click', this.setTopBind)
                document.removeEventListener('visibilitychange', this.visibilitychangeBind, true)
                window.removeEventListener('beforeunload', this.onbeforeunloadBind)
                resolve()
              },
              onError: () => {
                document.removeEventListener('click', this.setTopBind)
                document.removeEventListener('visibilitychange', this.visibilitychangeBind, true)
                window.removeEventListener('beforeunload', this.onbeforeunloadBind)
                resolve()
              },
            }
          )
        }
      })
    },
    /**
     * 设置水印
     * @param { Object } option 参数
     * @param { Number } snum 窗口数量
     * @param { String } item.color 水印颜色
     * @param { Number } item.fontSize 水印尺寸
     * @param { Number } item.fontWeight 字体粗细
     * @param { String } item.position 水印位置
     * @param { Number } item.text 文本
     */
    waterMark: function (option) {
      option.forEach((item) => {
        let rgb = item.color.split(',')
        let position = item.position.split(',')
        this.send({
          method: 'video.setOSDInfo',
          info: {
            snum: item.snum,
            R: rgb[0] || 255,
            G: rgb[1] || 255,
            B: rgb[2] || 255,
            fontSize: item.fontSize || 14,
            positionX: position[0] || 1,
            positionY: position[1] || 1,
            osdInfo: item.text || '',
            fontWeight: item.fontWeight || 0,
          },
        })
      })
    },
    // 设置窗口是否支持拖拽
    setWindowDragEnable: function () {
      this.send({
        method: 'window.enableDrag',
        info: {
          enable: this.setting.draggable,
        },
      })
    },
    // 设置全屏
    setFullScreen: function () {
      this.send({
        method: 'video.fullScreen',
        info: {},
      })
    },
    /**
     * @method chooseWindow 支持用户选择子窗口
     * @param { Number } snum 选择的子窗口，从0开始
     * @param { Function } cb 选中窗口回调
     */
    chooseWindow: function (snum, cb) {
      this.send({
        method: 'window.select',
        info: {
          snum,
        },
      })
      cb && cb(this.setting.channelList.filter((item) => item.snum === snum)[0])
    },
    /**
     * @method openAudio 开启、关闭声音
     * @param { Number } option.isEnable 0-关闭，1-开启
     * @param { Number } option.snum 选择的子窗口，从0开始
     */
    openAudio: function (option) {
      this.send({
        method: 'video.enableAudio',
        info: {
          snum: option.snum,
          isEnable: option.isEnable,
          videoType: Number(this.setting.windowType) === 0 ? 0 : 1, // 0-预览音频，1-回放音频
        },
      })
    },

    /**
     * @method startReal 实时预览集成
     * @param { Array } option
     * @param { String } item.channelId 通道Id （必传）
     * @param { String } item.channelName 通道名称(目前用于本地录像下载)
     * @param { Number } item.streamType 码流类型 1 主码流 2 辅码流 （默认主码流）
     * @param { Number } item.dataType 音视频类型  1-视频 2-音频 3-音视频 （默认视频）
     * @param { Number } item.deviceType 设备类别(用于对讲)
     * @param { Number|String } item.cameraType 摄像头类型(用于云台)
     * @param { Number } item.capability 能力集(用于云台)
     * @param { Boolean } isReOpen 是否断线重连
     * @param { Boolean } isSubStream 主辅码流切换 true 是 false 否
     * @param { String } deviceCode: option.channelId.split('$1$0$')[0],
     * @param { String } deviceType: option.deviceType,
     * @param { Number } talkType: getTalkType(option.deviceType),
     */
    startReal: function (option, { isReOpen, isSubStream, count } = {}, type = 'real') {
      let tempList = []
      // 切换窗口数
      let maxNum = option.map((item) => item.snum + 1).sort((a, b) => b - a)[0]
      if (maxNum > 64) {
        this.setting.realError &&
          this.setting.realError(item, {
            code: 209,
            message: '最大只支持64路播放',
          })
      }
      if (!isNaN(this.setting.division) && this.setting.division < maxNum) {
        this.changeDivision(maxNum)
      }
      option.forEach((item) => {
        let flag = false
        this.setting.channelList = this.setting.channelList.map((realItem) => {
          if (realItem.snum === item.snum) {
            flag = true
            return { ...item, closed: true } // close标识位：表示外部主动删除
          }
          return realItem
        })
        if (!flag) {
          tempList.push({ ...item })
        }

        // 如果有视频的关闭则优先关闭视频
        let playVideo = () => {
          // 如果是插件登录
          if (this.setting.usePluginLogin) {
            this.realByUrl(
              {
                ...item,
                path: '',
              },
              { isReOpen, isSubStream, count },
              true
            )
            return
          } else {
            if (!this.setting.request[type]) {
              this.setting.realError &&
                this.setting.realError(item, {
                  code: 207,
                  message: '请通过 request 属性传入实时预览接口',
                })
              return
            }
            this.setting.request[type](getAjaxParam(item, type))
              .then((res) => {
                if (res.url) {
                  this.realByUrl(
                    {
                      ...item,
                      path: dealUrl(res),
                    },
                    { isReOpen, isSubStream, count },
                    true
                  )
                }
              })
              .catch((err) => {
                this.setting.channelList = this.setting.channelList.filter((realItem) => realItem.snum !== item.snum)
                this.setting.realError && this.setting.realError(item, err)
              })
          }
        }

        if (!isReOpen && !isSubStream && flag) {
          this.closeVideo(item.snum).then(() => {
            playVideo()
          })
          return
        }
        playVideo()
      })
      this.setting.channelList = [...this.setting.channelList, ...tempList]
      // 强绑定
      window.dhPlayerControl.videoList[this.setting.videoId].setting.channelList = [...this.setting.channelList]
    },
    /**
     * @method realByUrl 通过rtsp流地址进行实时预览
     * @param { Number } option.snum 选择的子窗口，从0开始
     * @param { String } option.channelId 通道id
     * @param { String } option.channelName 通道名称(目前用于本地录像下载)
     * @param { String } option.path rtsp地址
     * @param { Boolean } option.redirect 重定向，默认false （拼接地址需要改为true，接口返回地址为false）
     * @param { String } option.cameraType 云台使用，相机类型 【暂不使用】
     * @param { Number } option.decodeMode 解码模式 软解-0 硬解-1 快速硬解-2 [默认快速硬解]
     * @param { Boolean } isSubStream 是否为主辅码流切换，true 表示是 false表示否
     * @param { Boolean } isReOpen 是否为实时预览断线重连
     * @param { Boolean } count 当前是第几次重连
     */
    realByUrl: function (option, { isSubStream, isReOpen, count } = {}, isProj) {
      let sendVideo = () => {
        this.send({
          method: 'video.realmonitor',
          info: {
            snum: option.snum,
            path: option.path,
            channelId: option.channelId,
            channelName: option.channelName || '',
            redirect: typeof option.redirect === 'boolean' ? option.redirect : false,
            camerType: option.cameraType,
            decodeMode: typeof option.decodeMode === 'number' ? option.decodeMode : 2,
            bStreamChange: !!isSubStream,
            reopenvideo: !!isReOpen,
            streamType: option.streamType || 1,
            count,
            deviceCode: (option.channelId && option.channelId.split('$1$0$')[0]) || '',
            deviceType: option.deviceType,
            talkType: getTalkType(option.deviceType),
          },
        })
      }
      // 非集成情况
      if (!isProj) {
        let index = this.setting.channelList.findIndex((item) => item.snum === option.snum)
        if (index >= 0) {
          this.setting.channelList[index] = { ...option, byUrl: true, closed: true }
        } else {
          this.setting.channelList.push({ ...option, byUrl: true })
        }
        // 强绑定
        window.dhPlayerControl.videoList[this.setting.videoId].setting.channelList = [...this.setting.channelList]
        if (!isReOpen && !isSubStream) {
          this.closeVideo(option.snum).then(() => {
            sendVideo()
          })
        }
        return
      }
      let timer = setInterval(() => {
        clearInterval(timer)
        if (!this.setting.hwnd) {
          this.realByUrl(option, { isSubStream, isReOpen, count }, isProj)
        } else {
          sendVideo()
        }
      }, 200)
    },
    /**
     * @method startTalk 对讲集成
     * @param { Number } snum 选择的子窗口，从0开始
     */
    startTalk: async function (snum = 0, type = 'talk') {
      let talkIndex = this.setting.channelList.findIndex((item) => item.snum === snum)
      if (talkIndex < 0) {
        return this.setting.talkError(talkParam, '当前窗口无实时预览')
      }
      let talkParam = this.setting.channelList[talkIndex]
      let param = getAjaxParam(talkParam, type).data
      if (!this.setting.request[type]) {
        this.setting.talkError &&
          this.setting.talkError(talkParam, {
            code: 207,
            message: '请通过 request 属性传入对讲接口和停止对讲接口',
          })
        return
      }
      this.setting.request[type]({ data: param })
        .then((res) => {
          talkParam.session = res.session
          // 保证所有参数都统一
          let { audioBit, audioType, sampleRate } = res
          talkParam.isTalk = true
          this.talkByUrl({
            redirect: false,
            audioBit,
            audioType,
            sampleRate,
            path: dealUrl(res),
            channelId: talkParam.channelId,
            talkType: getTalkType(talkParam.deviceType),
            snum,
          })
        })
        .catch((err) => {
          this.setting.talkError && this.setting.talkError(talkParam, err)
        })
    },

    /**
     * @method talkByUrl 通过rtsp流进行对讲
     * @param { Number } option.snum 窗口号
     * @param { String } option.channelId 通道id
     * @param { String } option.path rtsp地址
     * @param { Number } option.audioType 音频类型 0-default 1-PCM 2-G711a 3-AMR 4-G711U 5-G726 6-AAC 7-G722 8-G711
     * @param { Number } option.audioBit 位数 8 、16
     * @param { Number } option.sampleRate 采样频率 8000、16000、32000、48000、8192
     * @param { Number } option.talkType 对讲类型 1-设备 2-通道
     */
    talkByUrl: function (option) {
      // 发送对讲
      this.send({
        method: 'video.starttalk',
        info: {
          snum: option.snum,
          path: option.path,
          channelId: option.channelId,
          redirect: false, // 写死
          audioType: option.audioType,
          audioBit: option.audioBit,
          sampleRate: option.sampleRate,
          talkType: option.talkType,
        },
      })
    },

    /**
     * @method startPlayback 录像回放集成
     * @param { Array } option
     * @param { String } item.channelId 通道Id
     * @param { String } item.channelName 通道名称(目前用于本地录像下载)
     * @param { String } item.name 通道名称
     * @param { Number } item.streamType 码流类型 0 所有码流 1 主码流 2 辅码流 （默认所有码流）
     * @param { String } item.startTime 开始时间 '2022-10-26 00:00:00'
     * @param { String } item.endTime 结束时间 '2022-10-26 23:59:59'
     * @param { Number } item.recordSource 录像类型 2-设备录像 3-中心录像
     * @param { Number } option.snum 窗口号
     * @param { Boolean } isConnect 是否拖拽/播放下一段录像
     * @param { Boolean } bContinue 是否为播放下一段录像(用于告诉客户端)
     * @param { Boolean } scaleSteps 当前录像进度条的显示状态
     */
    startPlayback: function (option, { isConnect, bContinue, scaleSteps } = {}) {
      let timeFormatter = (time) => {
        return parseInt(new Date(time).getTime() / 1000)
      }
      let getPlayBackRtsp = (param) => {
        if (Number(param.recordSource) === 3 || Number(param.recordSource === 4)) {
          // 中心录像-按文件
          getPlayBackRtspByFile
            .call(this, param, isConnect)
            .then((res) => {
              if (res.code === 201) {
                return this.setting.playbackError && this.setting.playbackError(param, res)
              }
              param.endTime = Number(param.records[param.records.length - 1].endTime)
              this.playbackByUrl(
                {
                  ...param,
                  path: res.rtspUrl,
                  records: res.records,
                  redirect: false,
                  bContinue,
                  scaleSteps,
                  isLastFile: param.currentIndex === res.records.length - 1,
                },
                true
              )
            })
            .catch((err) => {
              this.setting.playbackError && this.setting.playbackError(param, err)
            })
        } else if (Number(param.recordSource) === 2) {
          // 设备录像-按时间
          getPlayBackRtspByTime
            .call(this, param)
            .then((res) => {
              param.endTime = Number(param.records[param.records.length - 1].endTime)
              this.playbackByUrl(
                {
                  ...param,
                  path: res.rtspUrl,
                  records: res.records,
                  redirect: false,
                  bContinue,
                  scaleSteps,
                  isLastFile: param.currentIndex === res.records.length - 1,
                },
                true
              )
            })
            .catch((err) => {
              this.setting.playbackError && this.setting.playbackError(param, err)
            })
        } else if (Number(param.recordSource) === 1) {
          // 自动识别
          queryRecord
            .call(this, param)
            .then(() => {
              let recordSource = param.records[0].recordSource
              param.recordSource = Number(recordSource)
              if (Number(recordSource) === 3 || Number(recordSource) === 4) {
                // 中心录像-按文件
                getPlayBackRtspByFile
                  .call(this, param, isConnect)
                  .then((res) => {
                    if (res.code === 201) {
                      return this.setting.playbackError && this.setting.playbackError(param, res)
                    }
                    param.endTime = Number(param.records[param.records.length - 1].endTime)
                    this.playbackByUrl(
                      {
                        ...param,
                        path: res.rtspUrl,
                        records: res.records,
                        redirect: false,
                        bContinue,
                        scaleSteps,
                        isLastFile: param.currentIndex === res.records.length - 1,
                      },
                      true
                    )
                  })
                  .catch((err) => {
                    this.setting.playbackError && this.setting.playbackError(param, err)
                  })
              }
              if (Number(recordSource) === 2) {
                // 设备录像-按时间
                getPlayBackRtspByTime
                  .call(this, param)
                  .then((res) => {
                    param.endTime = Number(param.records[param.records.length - 1].endTime)
                    this.playbackByUrl(
                      {
                        ...param,
                        path: res.rtspUrl,
                        records: res.records,
                        redirect: false,
                        bContinue,
                        scaleSteps,
                        isLastFile: param.currentIndex === res.records.length - 1,
                      },
                      true
                    )
                  })
                  .catch((err) => {
                    this.setting.playbackError && this.setting.playbackError(param, err)
                  })
              }
            })
            .catch((err) => {
              this.setting.playbackError && this.setting.playbackError(param, err)
            })
        } else {
          this.setting.playbackError &&
            this.setting.playbackError(param, {
              code: 404,
              message: '只能播放设备录像和中心录像！',
            })
        }
      }
      if (isConnect) {
        getPlayBackRtsp(option)
      } else {
        let channelList = []
        // 切换窗口数
        let maxNum = option.map((item) => item.snum + 1).sort((a, b) => b - a)[0]
        if (!isNaN(this.setting.division) && this.setting.division < maxNum) {
          this.changeDivision(maxNum)
        }
        option.forEach((item) => {
          // 对时间做格式化处理
          item.startTime = timeFormatter(item.startTime)
          item.endTime = timeFormatter(item.endTime)
          // 如果开始时间大于结束时间，则调换位置
          if (item.startTime > item.endTime) {
            let tempTime = item.startTime
            item.startTime = item.endTime
            item.endTime = tempTime
          }
          item.bBack = 0
          let flag = true
          this.setting.channelList.forEach((oItem, oIndex) => {
            if (oItem.snum === item.snum) {
              flag = false
              this.setting.channelList[oIndex] = { ...item, closed: true }
              this.closeVideo(item.snum).then(() => {
                // 播放视频
                if (this.setting.usePluginLogin) {
                  this.playbackByUrl(
                    {
                      ...item,
                      path: '',
                      records: [],
                      redirect: false,
                      bContinue,
                      scaleSteps,
                    },
                    true
                  )
                } else {
                  getPlayBackRtsp({ ...item })
                }
              })
            }
          })
          if (flag) {
            channelList.push({ ...item })
          }
        })
        channelList.forEach((item) => {
          if (this.setting.usePluginLogin) {
            this.playbackByUrl(
              {
                ...item,
                path: '',
                records: [],
                redirect: false,
                bContinue,
                scaleSteps,
              },
              true
            )
          } else {
            getPlayBackRtsp({ ...item })
          }
        })
        this.setting.channelList = [...this.setting.channelList, ...channelList]
        // 强绑定
        window.dhPlayerControl.videoList[this.setting.videoId].setting.channelList = [...this.setting.channelList]
      }
    },

    /**
     * @method playbackByUrl 通过rtsp录像回放
     * @param { Number } option.snum 选择的子窗口，从0开始
     * @param { String } option.channelId 通道id
     * @param { String } option.channelName 通道名称(目前用于本地录像下载)
     * @param { String } option.path rtsp地址
     * @param { Array } option.records 包含某个时间段的录像文件信息
     * @param { Date } option.startTime 时间相关均为时间戳（new Date().getTime() / 1000）
     * @param { Date } option.endTime 时间相关均为时间戳（new Date().getTime() / 1000）
     * @param { Number } option.recordSource 录像类型 2-设备录像 3-中心录像 4-统一云
     * @param { Number } option.decodeMode 解码模式 软解-0 硬解-1 快速硬解-2 [默认快速硬解]
     * @param { Boolean } option.redirect 重定向，默认false （拼接地址需要改为true，接口返回地址为false）
     * @param { Boolean } option.bContinue 是否继续播放录像 true-是  false-否
     * @param { Boolean } bContinue 是否续播
     * @param { Number } scaleSteps 录像进度条样式
     * @param { Boolean } isLastFile 是否为最后一段录像？
     */
    playbackByUrl: function (option, isProj) {
      // 非集成情况
      if (!isProj) {
        let index = this.setting.channelList.findIndex((item) => item.snum === option.snum)
        if (index >= 0) {
          this.setting.channelList[index] = { ...option, byUrl: true }
        } else {
          this.setting.channelList.push({ ...option, byUrl: true })
        }
      }
      this.send({
        method: 'video.playback',
        info: {
          snum: option.snum,
          path: option.path,
          records: option.records,
          startTime: option.startTime,
          endTime: option.endTime,
          recordSource: option.recordSource,
          playStartTime: option.playStartTime || option.startTime,
          playEndTime: option.playEndTime || option.endTime,
          currentPlayTime: option.currentPlayTime || option.playStartTime,
          channelId: option.channelId,
          channelName: option.channelName || option.name || '',
          decodeMode: typeof option.decodeMode === 'number' ? option.decodeMode : 2,
          redirect: typeof option.redirect === 'boolean' ? option.redirect : false,
          bBack: option.bBack || 0,
          bContinue: !!option.bContinue,
          scaleSteps: option.scaleSteps || 0,
          lastFile: !!option.isLastFile,
        },
      })
    },
    /**
     * @method startDownloadRecord 开始下载录像-集成
     * @param {*} option 参数同 startPlayback 方法
     */
    startDownloadRecord: function (option) {
      let timeFormatter = (time) => {
        return parseInt(new Date(time).getTime() / 1000)
      }
      let getPlayBackRtsp = (param) => {
        if (Number(param.recordSource) === 3 || Number(param.recordSource) === 4) {
          // 中心录像-按文件
          getPlayBackRtspByFile
            .call(this, param)
            .then((res) => {
              if (res.code === 201) {
                return this.setting.downloadError && this.setting.downloadError(param, res)
              }
              param.endTime = Number(param.records[param.records.length - 1].endTime)
              this.downloadRecord({
                snum: param.snum,
                url: res.rtspUrl,
                records: res.records,
                startTime: param.startTime,
                endTime: param.endTime,
              })
            })
            .catch((err) => {
              this.setting.downloadError && this.setting.downloadError(param, err)
            })
        } else if (Number(param.recordSource) === 2) {
          // 设备录像-按时间
          getPlayBackRtspByTime
            .call(this, param)
            .then((res) => {
              param.endTime = Number(param.records[param.records.length - 1].endTime)
              this.downloadRecord({
                snum: param.snum,
                url: res.rtspUrl,
                records: res.records,
                startTime: param.startTime,
                endTime: param.endTime,
              })
            })
            .catch((err) => {
              this.setting.downloadError && this.setting.downloadError(param, err)
            })
        } else {
          this.setting.downloadError &&
            this.setting.downloadError(param, {
              code: 404,
              message: '只能下载设备录像和中心录像！',
            })
        }
      }
      if (option.length > 4) {
        return this.setting.downloadError({
          code: 401,
          message: '最多支持4路录像同时下载',
        })
      }
      option.forEach((item) => {
        // 对时间做格式化处理
        item.startTime = timeFormatter(item.startTime)
        item.endTime = timeFormatter(item.endTime)
        // 如果开始时间大于结束时间，则调换位置
        if (item.startTime > item.endTime) {
          let tempTime = item.startTime
          item.startTime = item.endTime
          item.endTime = tempTime
        }
        item.bBack = 0
        getPlayBackRtsp(item)
      })
    },
    /**
     * 处理DHPlayer位置
     * @param {*} option
     * @param {*} callBack
     * @returns
     */
    changePosition: function (option, callBack) {
      var windowSize = getWindowSize.call(this)
      var zoom = detectZoom()
      var rect = getRect.call(this)
      for (let i in rect) {
        rect[i] = (rect[i] * zoom) / 100
      }
      var _info = Object.assign({}, {}, rect, option)
      _info.clientAreaHeight = (windowSize.height * zoom) / 100
      _info.clientAreaWidth = (windowSize.width * zoom) / 100
      _info.browserScreenX = getScreenX()
      // 暂时用不到
      _info.screenX = window.screenX
      _info.screenY = window.screenY
      // 火狐需要传的内容
      if (!window.dhPlayerControl.isPIframe) {
        _info.mozInnerScreenX = (window.top.mozInnerScreenX * zoom) / 100
        _info.mozInnerScreenY = (window.top.mozInnerScreenY * zoom) / 100
      } else {
        _info.mozInnerScreenX = (this.setting.topMozInnerScreenX * zoom) / 100
        _info.mozInnerScreenY = (this.setting.topMozInnerScreenY * zoom) / 100
      }
      delete _info.width
      delete _info.height
      _info.show = document.visibilityState === 'hidden' ? false : true
      _info.title = window.dhPlayerControl.isPIframe ? this.setting.documentTitle : window.top.document.title
      let sendPosition = () => {
        this.send(
          {
            method: 'window.change',
            info: _info,
          },
          callBack
        )
      }
      // 位置改变后就触发遮挡
      if (this.setting.oldPosition === JSON.stringify(_info)) {
        // 位置固定后，改变三次位置，强制触发三次遮挡，处理位置偏移问题。
        while (this.adjustCount < 3) {
          this.adjustCount++
          sendPosition()
          this.windowShield(this.cover(), true)
        }
        return
      }
      // 位置发生改变，强制触发遮挡事件
      this.adjustCount = 0
      this.setting.oldPosition = JSON.stringify(_info)
      sendPosition()
    },
    // 隐藏视频
    hide: function () {
      this.setting.show = false
      this.setting.stopRefresh = true
      this.send({
        method: 'window.show',
        info: {
          show: false,
        },
      })
    },
    //显示视频
    show: function () {
      var that = this
      this.setting.stopRefresh = false
      this.setting.show = true
      this.send(
        {
          method: 'window.show',
          info: {
            show: true,
          },
        },
        {
          onSuccess: function () {
            if (that.setting.refreshTimer) {
              window.cancelAnimationFrame(that.setting.refreshTimer)
            }
            that.setting.oldPosition = ''
            that.handleAdjust()
            that.setting.showWindowSuccess && that.setting.showWindowSuccess()
          },
          onError: this.setting.showWindowError,
        }
      )
    },

    /**
     * @method downloadRecord 录像下载
     * @param { Object } option
     * @param { Number } option.snum 选择的子窗口，从0开始
     * @param { String } option.url 下载地址
     * @param { Array } option.records 包含某个时间段的录像文件信息
     * @param { Number } option.startTime 时间相关均为时间戳,具体参考大华播放控件开发手册
     * @param { Number } option.endTime 时间相关均为时间戳,具体参考大华播放控件开发手册
     * @param { Boolean } option.redirect 默认 false
     */
    downloadRecord: function (option) {
      this.send({
        method: 'video.downloadByTime',
        info: {
          channelId: option.channelId,
          snum: option.snum,
          url: option.url,
          records: option.records,
          startTime: option.startTime,
          endTime: option.endTime,
          redirect: typeof option.redirect === 'boolean' ? option.redirect : false,
        },
      })
    },
    /**
     * @method closeVideo 关闭指定窗口视频或全部关闭
     * @param { Number } option.snum 选择的子窗口, 不传默认全部关闭
     */
    closeVideo: function (snum) {
      return new Promise((resolve) => {
        this.send(
          {
            method: 'video.close',
            info: {
              snum: typeof snum === 'number' ? snum : 0,
              isAll: typeof snum === 'number' ? false : true,
            },
          },
          {
            onSuccess: function () {
              resolve()
            },
          }
        )
      })
    },
    /**
     * @method closeTalk 关闭对讲
     */
    closeTalk: function () {
      this.send({
        method: 'video.closetalk',
        info: {
          snum: 0,
          isAll: true,
        },
      })
    },
    /**
     * @method continuePlayback 操作录像
     * @param { Number } option.snum 选择的子窗口，从0开始
     * @param { Number } option.state 窗口状态：0-暂停，1-继续
     */
    controlPlayback: function (option) {
      this.send({
        method: 'video.playbackChangeState',
        info: {
          snum: option.snum,
          state: option.state,
        },
      })
    },

    //显示下方控制栏, show: true-显示，false-隐藏
    showControlBar: function (show = true) {
      this.setting.showBar = show
      this.send({
        method: 'video.setToolBarShow',
        info: {
          isShow: show ? 1 : 0,
        },
      })
    },
    /**
     * @method continuePlayback 本地录像下载
     * @param { Number } snum 选择的子窗口，从0开始
     */
    localRecordDownload: function (snum) {
      this.send({
        method: 'vidoe.localRecord',
        info: {
          snum,
        },
      })
    },
    /**
     * @method video.division.change 切换当前控件展示的窗口数量
     * @param {*} division 当前控件展示的窗口数量
     * @param {String} 分割窗口数类型 normal-正常 custom-自定义
     * @desc 代码手动调用该方法没有提供回调，此处添加回调
     */
    changeDivision: function (info) {
      if (info) {
        // 自定义的情况
        if (isNaN(info)) {
          this.setting.division = info
          this.send({
            method: 'video.customDivision.change',
            info: JSON.parse(info),
          })
          this.setting.changeDivision && this.setting.changeDivision(info)
        } else {
          this.setting.division = Number(info)
          this.send({
            method: 'video.division.change',
            info: {
              division: this.setting.division,
            },
          })
          this.setting.changeDivision && this.setting.changeDivision(this.setting.division)
        }
        this.setWindowDragEnable()
      }
    },
    //窗口抓图
    snapshot: function (snum) {
      this.send({
        method: 'video.snapic',
        info: {
          snum,
        },
      })
    },
    // 视频被遮挡处理
    windowShield: function (option, flag, callBack) {
      var windowSize = getWindowSize.call(this)
      var zoom = detectZoom()
      var _info = {}
      _info.region = this.getShieldRect(option).map((item) => (item * zoom) / 100)
      _info.clientAreaHeight = (windowSize.height * zoom) / 100
      _info.clientAreaWidth = (windowSize.width * zoom) / 100
      if (!flag && this.setting.oldShield === JSON.stringify(_info)) {
        return
      }
      this.setting.oldShield = JSON.stringify(_info)
      this.send(
        {
          method: 'window.shield',
          info: _info,
        },
        callBack
      )
    },
    // 视频插件版本号
    version: function (callBack) {
      this.send(
        {
          method: 'common.version',
          info: {},
        },
        callBack
      )
    },
    /**
     * 视频是否显示规划线
     * @param { Object } option
     * @param { Number } snum 窗口号
     * @param { isEnableIVS } 是否显示规则框 true-显示 false-隐藏
     * @param { ivsType } 规则框类型 1-智能规则框，2-智能目标框 (不传默认为1)
     */
    isEnableIvs: function (option) {
      this.send({
        method: 'video.enableIvs',
        info: {
          snum: option.snum,
          isEnableIVS: option.isEnableIVS,
          ivsType: option.ivsType,
        },
      })
    },

    getWindowState: function (callBack) {
      this.send(
        {
          method: 'window.getWindowState',
          info: {},
        },
        callBack
      )
    },
    // 防止插件超出浏览器显示
    cover: function () {
      var rect = getRect.call(this)
      var left = rect.left,
        top = rect.top,
        right = rect.right,
        bottom = rect.bottom,
        width = rect.width,
        height = rect.height,
        arr = [],
        windowSize = getWindowSize.call(this)

      let shieldFn = (domSize) => {
        if (domSize && domSize[0]) {
          // 超过上方则遮挡
          if (top < domSize[0].top) {
            arr.push(left, top, width + 1, domSize[0].top - top)
          }
          // 超过下方则遮挡
          if (bottom > domSize[0].bottom) {
            arr.push(left, domSize[0].bottom, width + 1, bottom - domSize[0].bottom)
          }
          // 左侧遮挡
          if (left < domSize[0].left) {
            arr.push(left, top, domSize[0].left - left + 1, height)
          }
          // 右侧遮挡
          if (right > domSize[0].right) {
            arr.push(domSize[0].right, top, right - domSize[0].right + 1, height)
          }
        }
      }
      // 处理有iframe下， 超出最外侧body遮挡的问题
      shieldFn([
        {
          top: 0,
          left: 0,
          right: windowSize.width,
          bottom: windowSize.height,
        },
      ])
      // 处理当前window下的遮挡问题
      let pOutContent, outLeft, outTop
      if (window.dhPlayerControl.isPIframe) {
        pOutContent = this.setting.pIframeRect
        outLeft = pOutContent.left
        outTop = pOutContent.top
      } else {
        var iframes = window.parent.document.getElementsByTagName('iframe')
        var pIframe = null
        var dom = null
        let getpIframe = (index) => {
          if (!iframes[index]) return
          try {
            dom = iframes[index].contentWindow.document.getElementById(this.setting.videoId)
            if (dom) {
              pIframe = iframes[index]
            } else {
              getpIframe(index + 1)
            }
          } catch (err) {
            getpIframe(index + 1)
          }
        }
        iframes.length && getpIframe(0)
        if (pIframe) {
          pOutContent = pIframe.getBoundingClientRect()
        }
      }
      pOutContent &&
        shieldFn([
          {
            top: pOutContent.top,
            left: pOutContent.left,
            width: pOutContent.width,
            height: pOutContent.height,
          },
        ])
      // 处理DOM元素遮挡问题，主要用于滚动页面，超出隐藏的问题
      if (this.setting.coverShieldClass && this.setting.coverShieldClass.length) {
        this.setting.coverShieldClass.forEach((item) => {
          let dom = document.getElementsByClassName(item)[0]
          let domSize = dom ? dom.getClientRects() : null
          domSize = [
            {
              left: domSize[0].left,
              top: domSize[0].top,
              bottom: domSize[0].bottom,
              right: domSize[0].right,
            },
          ]
          if (pOutContent) {
            domSize[0].left = domSize[0].left + pOutContent.left
            domSize[0].top = domSize[0].top + pOutContent.top
            domSize[0].bottom = domSize[0].top + domSize[0].height
            domSize[0].right = domSize[0].left + domSize[0].width
          }
          domSize && shieldFn(domSize)
        })
      }
      return arr
    },

    /**
     * @desc 登录平台
     * @param {String} host ip
     * @param {String} port 端口
     * @param {String} username 用户名
     * @param {String} password 密码
     * */
    loginServer: function () {
      this.send({
        method: 'window.loginServer',
        info: {
          host: this.setting.pluginLoginInfo.host,
          port: String(this.setting.pluginLoginInfo.port), // 自动转换为字符串
          username: this.setting.pluginLoginInfo.username,
          password: this.setting.pluginLoginInfo.password,
        },
      })
    },

    //  退出登录
    logoutServer: function () {
      return new Promise((resolve, reject) => {
        this.send({
          method: 'window.logoutServer',
          info: {},
        })
        setTimeout(() => {
          resolve()
        }, 2000)
      })
    },

    // 获取登录状态信息
    getLoginState: function () {
      this.send({
        method: 'window.getLoginState',
        info: {},
      })
    },

    // 获取登录信息
    getLoginInfo: function () {
      this.send({
        method: 'window.getLoginInfo',
        info: {},
      })
    },

    // 扩展方法
    extendOption: function (ids, option) {
      var map = {}
      for (var i = 0; i < ids.length; i++) {
        map[ids[i]] = this.setting[ids[i]]
      }
      return Object.assign({}, map, option)
    },
    //遮挡部分位置获取
    getShieldRect: function (option) {
      // 获取位置信息
      var shieldClass = this.setting.shieldClass || [],
        arr = option || []
      for (var i = 0; i < shieldClass.length; i++) {
        arr = [...arr, ...computedRect.call(this, shieldClass[i])]
      }
      if (window.dhPlayerControl.isPIframe) {
        arr.push(...this.setting.pIframeShieldData)
      } else {
        var parentIframeShieldClass = this.setting.parentIframeShieldClass || []
        for (i = 0; i < parentIframeShieldClass.length; i++) {
          arr = [...arr, ...computedRect.call(this, parentIframeShieldClass[i], true)]
        }
      }
      return arr
    },
    MainCall: function (option) {
      var dom = document.getElementById(this.setting.ieDom)
      this.setting.option_id[option.id] = option
      dom && dom.MainCall(option.method, JSON.stringify(option))
    },
    init: function () {
      // 判断是不是跨域
      try {
        window.dhPlayerControl.isPIframe = false
        this.initPlayer()
      } catch (err) {
        // 是跨域
        window.dhPlayerControl.isPIframe = true
        addEventListener('message', (e) => {
          if (e.data.methods === 'title') {
            this.setting.documentTitle = e.data.title || document.title
          }
          if (e.data.methods === 'rect') {
            this.setting.topInnerWidth = e.data.topInnerWidth || 0
            this.setting.topInnerHeight = e.data.topInnerHeight || 0
            this.setting.pIframeRect = e.data.pIframeRect || 0
            this.setting.topMozInnerScreenX = e.data.topMozInnerScreenX || 0
            this.setting.topMozInnerScreenY = e.data.topMozInnerScreenY || 0
          }
          if (e.data.methods == 'shieldRect') {
            this.setting.pIframeShieldData = e.data.pIframeShieldData || []
          }
        })
        this.initPlayer()
      }
    },
    initPlayer: function () {
      let hwnd = ''
      if (window.dhPlayerControl.videoList[this.setting.videoId]) {
        hwnd = window.dhPlayerControl.videoList[this.setting.videoId].setting.hwnd
      }
      window.dhPlayerControl.videoList[this.setting.videoId] = this
      this.setting.hwnd = hwnd
      if (!window.dhPlayerControl.wsConnect) {
        window.dhPlayerControl.wsConnect = true
        socketOpen.call(this)
      } else {
        if (
          window.dhPlayerControl.windowState === 'wsSuccess' &&
          (!this.setting.usePluginLogin || window.dhPlayerControl.loginFlag !== 'LOGIN_PENDING')
        ) {
          // 建立连接后, 确保每次初始化是否支持
          let _isSupport = isSupport()
          if (!_isSupport.success) {
            return this.setting.createError && this.setting.createError(_isSupport)
          }
          if (this.setting.socketTimer) {
            clearTimeout(this.setting.socketTimer)
          }
          this.setting.socketTimer = setTimeout(
            () => {
              this.create()
            },
            this.setting.usePluginLogin ? 1000 : 300
          )
        } else if (window.dhPlayerControl.windowState === 'wsError') {
          this.setting.createError &&
            this.setting.createError({
              code: 1001,
              success: false,
              message: '无法与播放器建立连接',
            })
        } else {
          setTimeout(() => {
            this.initPlayer()
          }, 300)
        }
      }
      this.setting.browserType = broswerInfo()
    },
  }
  window.VideoPlayer = window.VideoPlayer || VideoPlayer
})()
