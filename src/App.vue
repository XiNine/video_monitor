<template>
  <div id="app">
    <monitorVideo
      width="600"
      height="400"
      index="videoHome"
      code="44030500581314000014"
    />
  </div>
</template>

<script>
import monitorVideo from "./components/monitorVideo.vue";
export default {
  name: "App",
  components: {
    monitorVideo,
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
