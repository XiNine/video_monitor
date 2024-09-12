<script>
/* 大华视频播放--组件存放 */
import '@/utils/videoPlayer.js';
import { mapState } from 'vuex'
export default {
   props: {
      config: {
         type: Object,
         required: true,
      },
      code: {
         type: [String, Number],
         required: true,
      },
      channelName: {
         type: String,
         default: '',
      },
      type: {
         type: Number,
         default: 0,
      },
      index: {
         type: [String, Number],
         default: () => 0,
      },
      time: {
         type: Array,
         default: () => [new Date(new Date() - 3600 * 1000 * 24 * 1), new Date()]
      },
      width: {
         type: String,
         default: '100%',
      },
      height: {
         type: String,
         default: '100%',
      },
   },
   data() {
      return {
         oWebControl: null,
         videoLoad: false,
         loading:false,
      }
   },
   computed: {
      styles() {
         const stu = this.width.includes('%') || this.width.includes('px')
         return {
            width: stu ? `${this.width}` : `${this.width}px`,
            height: stu ? `${this.height}` : `${this.height}px`,
         }
      },
      idName() {
         return `playWnd${this.index}`
      },
      ...mapState({
         videoName: state => state.videoCurrent?.name || state.videoCurrent?.manufactor
      })
   },
   watch: {
      code: {
         handler() {
            this.initPlugin()
         },
         immediate: true,
      },
      videoName(val) {
         if (val !== '大华') this.getDestruction()
      }
   },
   methods: {
      /* 初始化 */
      initPlugin(type = this.type) {
         if (this.videoName !== '大华') return;
         this.loading = true;
         this.getDestruction()
         const videoId = this.idName;
         this.oWebControl = new VideoPlayer({
            videoId: videoId,
            usePluginLogin: true,
            isResetConnect: true,
            pluginLoginInfo: {
               host: this.config.ip,
               port: this.config.port,
               username: window.atob(this.config.username),
               password: window.atob(this.config.password),
            },
            coverShieldClass: [],
            shieldClass: [],
            division: 1,
            draggable: false,
            showBar: true,
            windowType: [0, 3][type],
            createSuccess: (versionInfo) => {
               console.log('播放器创建成功', versionInfo)
               this.loading = false;
               [this.getClickAction, this.setPlayback][type]()
            },
            createError: (err) => {
               console.log('播放器创建失败', err)
               this.loading = false;
               if (this.videoName !== '大华') this.getDestruction()
               if (err.code !== 1004) this.videoLoad = true;
            },
            // 实时预览，成功回调
            realSuccess: (info) => {
               console.log('实时预览成功', info);

            },
            // 实时预览，错误回调
            realError: (info, err) => {
               console.log('实时预览失败', info, err);
            },
            // 抓图成功回调
            snapshotSuccess({ base64Url, path }, info) {
               this.downloadFile(path)
            },
         })
         // console.log(this.oWebControl,'this.oWebControl');
      },
      /* 下载图片 */
      downloadFile(url, name = new Date().valueOf()) {
         const alink = document.createElement('a')
         alink.setAttribute('href', url)
         alink.setAttribute('download', name)
         alink.setAttribute('target', '_blank')
         alink.click()
         setTimeout(() => alink.remove(), 1000)
      },
      /* 视频预览 */
      getClickAction() {
         this.oWebControl.startReal({
            channelId: this.code,//通道id
            channelName: this.channelName,
            snum: 0,
            cameraType: '1',
            capability: '00000000000000000000000000000001',
         })
      },
      /* 录像回放 */
      setPlayback() {
         const [startTime, endTime] = [this.$getTime(this.time[0]), this.$getTime(this.time[1])]
         this.oWebControl.startPlayback({
            channelId: this.code,
            channelName: this.channelName,
            startTime: startTime,
            endTime: endTime,
            recordSource: 3,
            streamType: 0,
            snum: 0,
         })
      },
      /* 获取流地址中的参数 */
      getUrlParam(url, name) {
         const reg = new RegExp(`(^|&)${name}=([^&]*)(&|$)`)
         const target = url.match(reg)
         if (target != null) return decodeURIComponent(target[2])
         return null
      },
      setShow(stu) {
         stu ? this.oWebControl.show() : this.oWebControl.hide()
      },
      downAction() {
         const urls = window.location.origin
         window.location.href = `${urls}/media/DHPlayerSetup.exe`
      },
      /* 销毁播放器 */
      async getDestruction() {
         if (this.oWebControl) {
            this.setShow(false)
            await this.oWebControl.destroy()
         }
      },
   },
   beforeDestroy() {
      this.getDestruction()
   },
}
</script>

<template>
   <div id="dahuaVideo" :style="styles" v-loading="loading" element-loading-text="连接创建中..."
      element-loading-spinner="el-icon-loading" element-loading-background="rgba(0, 0, 0, 0.8)">
      <div :id="idName" class="playWnd"></div>
      <div class="video-tips" v-if="videoLoad">
         <div class="click-txt fs-16 mb-4" @click="downAction">点我下载控件</div>
         <div class="tips-txt">安装后如为启动可尝试刷新网页或重开浏览器</div>
      </div>
   </div>
</template>

<style lang='less' scoped>
#dahuaVideo {
   border-radius: 4px;
   position: relative;

   .playWnd {
      width: 100%;
      height: 100%;
   }

   .video-tips {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;

      .click-txt {
         color: red;
         font-weight: bold;
         cursor: pointer;
         z-index: 30;
      }

      .tips-txt {
         font-size: 14;
         color: #696969;
         text-wrap: nowrap;
      }
   }
}
</style>