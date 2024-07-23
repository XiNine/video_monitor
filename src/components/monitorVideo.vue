<script>
export default {
  props: {
    code: {
      //摄像头编号
      type: String,
      required: true,
    },
    index: {
      //多个视频循环的索引或唯一标识
      type: [String, Number],
      default: () => 0,
    },
    type: {
      //播放模式 0 预览 1 回放
      type: Number,
      default: 1,
    },
    time: {
      //回放的时间段
      type: Array,
      default: () => [new Date(new Date() - 3600 * 1000 * 24 * 1), new Date()],
    },
    scrollDom: {
      //滚动父元素的class类名
      type: String,
      default: "",
    },
    width: {
      //盒子宽度
      type: String,
      default: "100",
    },
    height: {
      //盒子高度
      type: String,
      default: "100",
    },
  },
  data() {
    return {
      oWebControl: null, //插件实例
      videoLoad: false, //插件是否安装
      initCount: 0, //尝试启动插件次数
      config: {
        //海康后台提供的网关信息，需要叫后端配置好提供给你，或者接口请求回来（！！！必填！！！）
        appkey: "",
        secret: "",
        ip: "",
        port: 443, //只能是number类型否则白屏
      },
    };
  },
  computed: {
    styles() {
      const stu = this.width.includes("%") || this.width.includes("px");
      return {
        width: stu ? `${this.width}` : `${this.width}px`,
        height: stu ? `${this.height}` : `${this.height}px`,
      };
    },
    idName() {
      return `playWnd${this.index}`;
    },
  },
  mounted() {
    this.init();
  },
  methods: {
    /* 初始化 */
    init() {
      /* 可以直接用的，vue3改写下语法就行 */
      this.getDestruction();
      this.initPlugin();
      window.addEventListener("resize", this.getDomInfo);
      if (this.scrollDom) {
        const dom = document.querySelector(`.${this.scrollDom}`);
        dom.addEventListener("scroll", this.getDomInfo);
      }
    },
    /* 创建插件实例 */
    initPlugin() {
      this.videoLoad = false;
      const dll = { dllPath: "./VideoPluginConnect.dll" };
      const videoId = this.idName;
      let oWebControl = new WebControl({
        szPluginContainer: videoId, // 指定容器id
        iServicePortStart: 15900, //不用变
        iServicePortEnd: 15909, //不用变，或者15900
        szClassId: "23BF3B0A-2C56-4D97-9C03-0CB103AA8F11", // 用于IE10使用ActiveX的clsid
        cbConnectSuccess: () => {
          oWebControl.JS_StartService("window", dll).then(() => {
            oWebControl.JS_SetWindowControlCallback({
              cbIntegrationCallBack: (msg) => {
                if (msg?.responseMsg?.msg?.result) {
                  const { result } = msg.responseMsg.msg;
                  if (result == 1024) {
                    oWebControl.JS_HideWnd(); //放大隐藏其它视频窗口
                  } else if (result == 1025) {
                    oWebControl.JS_ShowWnd(); //缩小显示全部窗口
                  }
                }
              },
            });
            //启动插件服务成功，JS_CreateWnd创建视频播放窗口，宽高可设定
            const { width, height } = document
              .getElementById(videoId)
              .getBoundingClientRect();
            oWebControl
              .JS_CreateWnd(videoId, width, height)
              .then(() => this.initVideo(oWebControl, this.code));
          });
        },
        //插件服务启动失败，尝试自行启动
        cbConnectError: (err) => {
          oWebControl = null;
          this.$message.warning(
            `监控插件未启动，正在尝试第${this.initCount + 1}次启动，请稍候...`
          );
          WebControl.JS_WakeUp("VideoWebPlugin://");
          this.initCount++;
          if (this.initCount < 2) {
            setTimeout(() => this.initPlugin(), 3000);
          } else {
            this.videoLoad = true; //打开下载提示，请先安装视频插件
          }
        },
      });
      this.oWebControl = oWebControl;
    },

    /* 获取公钥 */
    async initVideo(oWebControl, code) {
      const params = {
        funcName: "getRSAPubKey",
        argument: JSON.stringify({ keyLength: 1024 }),
      };
      const { responseMsg } = await oWebControl.JS_RequestInterface(params);
      if (responseMsg.data) {
        const pubKey = responseMsg.data;
        this.getVideoConfig(oWebControl, pubKey, code);
      }
    },

    /* 初始化-视频插件配置 */
    getVideoConfig(oWebControl, pubKey, code) {
      const { appkey, secret, ip, port } = this.config;
      const configObj = {
        funcName: "init",
        argument: JSON.stringify({
          appkey, //API网关提供的appkey
          secret: this.setEncrypt(secret, pubKey), //网关提供的secret
          ip, //网关IP地址
          port: +port, //端口，特别注意一定要是number类型，否则白屏
          playMode: this.type, //播放模式：0实时预览、1视频回放
          snapDir: "D:\\SnapDir", //抓图存储路径
          videoDir: "D:\\VideoDir", //紧急录像或录像剪辑存储路径
          layout: "1x1", //布局方式
          enableHTTPS: 1, //是否启用HTTPS协议
          encryptedFields: "secret", //加密字段
          showToolbar: 1, //是否显示工具栏
          showSmart: 1, //是否显示智能信息
          buttonIDs: "0,16,256,257,258,259,260,512,513,514,515,516,517,768,769", //自定义工具条按钮
        }),
      };
      oWebControl.JS_RequestInterface(configObj).then(async () => {
        await this.getDomInfo();
        await this.getClickAction(oWebControl, code);
      });
    },

    /* 更新视频视频的位置及大小改变 */
    getDomInfo() {
      const oWebControl = this.oWebControl;
      const { width, height, top, left } = document
        .getElementById(this.idName)
        .getBoundingClientRect();
      if (oWebControl) {
        oWebControl.JS_Resize(width, height);
        oWebControl.JS_CuttingPartWindow(left, top, 0, 0);
      }
    },
    /* 视频流RSA加密 */
    setEncrypt(value, pubKey) {
      const encrypt = new JSEncrypt();
      encrypt.setPublicKey(pubKey);
      return encrypt.encrypt(value);
    },

    /* 启动播放 */
    getClickAction(oWebControl = this.oWebControl, code = this.code) {
      code = code.replace(/(\s*$)/g, '')
      const funcName = this.type ? 'startPlayback' : 'startPreview';
      const [startTime,endTime] = [this.$getTime(this.time[0]),this.$getTime(this.time[1])];
      const startTimeStamp = Math.floor(new Date(startTime).getTime() / 1000).toString();
      const endTimeStamp = Math.floor(new Date(endTime).getTime() / 1000).toString();
      const params1 = { cameraIndexCode: code, streamMode: 0, transMode: 1, gpuMode: 0, wndId: -1 }
      const params2 = { ...params1, startTimeStamp, endTimeStamp }
      const params = this.type ? params2 : params1
      oWebControl.JS_RequestInterface({
        funcName: funcName,
        argument: JSON.stringify(params),
      })
    },

    /* 销毁实例 */
    async getDestruction() {
      if (this.oWebControl) {
        window.removeEventListener('resize', this.getDomInfo)
        if(this.scrollDom){
          const dom = document.querySelector(`.${this.scrollDom}`)
          dom.removeEventListener('scroll', this.getDomInfo)
        }
        await this.oWebControl.JS_HideWnd();
        await this.oWebControl.JS_Disconnect();
      }
    },

    /* 显示隐藏 */
    setShow(stu) {
      stu ? this.oWebControl.JS_ShowWnd() : this.oWebControl.JS_HideWnd()
    },

    /* 下载插件--如果不允许访问外网就把插件放到自己服务器 */
    downAction() {
      const urls = window.location.origin;
      window.location.href = `${urls}/media/VideoWebPlugin.exe`;
    },
    getTime(times, status = true, str) {
      const time = new Date(times);
      const year = time.getFullYear();
      const month = (time.getMonth() + 1).toString().padStart(2, "0");
      const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
        time.getDay()
      ];
      const day = time.getDate().toString().padStart(2, "0");
      const hours = time.getHours().toString().padStart(2, "0");
      const minute = time.getMinutes().toString().padStart(2, "0");
      const second = time.getSeconds().toString().padStart(2, "0");
      if (status) return `${year}-${month}-${day} ${hours}:${minute}:${second}`;
      switch (str) {
        case "年":
          return year;
        case "月":
          return month;
        case "周":
          return week;
        case "日":
          return day;
        case "时":
          return hours;
        case "分":
          return minute;
        case "秒":
          return second;
        default:
          return `${year}-${month}-${day}`;
      }
    },
  },

  /* 路由跳转时销毁--以防万一开了缓存保险一点 */
  beforeRouteEnter(to, from, next) {
    next((vue) => vue.getDestruction());
  },

  /* 销毁 */
  beforeDestroy() {
    this.getDestruction();
  },
};
</script>

<template>
  <!-- 视频监控 -->
  <div class="videoContent" :style="styles">
    <div :id="`playWnd${index}`" class="playWnd"></div>
    <div class="video-tips" v-if="videoLoad" @click="downAction">
      请先安装视频插件
    </div>
  </div>
</template>

<style scoped>
/* 如果出警告不用管，原生css已支持这种层级写法无需安装css预编译器 */
.videoContent {
  border-radius: 4px;
  position: relative;
  .playWnd {
    width: 100%;
    height: 100%;
  }
  .video-tips {
    color: red;
    font-weight: bold;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    cursor: pointer;
    z-index: 30;
  }
}
</style>
