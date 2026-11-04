import { createApp } from 'vue'
import App from './App.vue'
import { router } from './app/router'
import 'vant/lib/index.css'
import './styles/tokens.css'
import './styles/responsive.css'
import './app/install'
const app = createApp(App)
app.use(router)
app.config.errorHandler = (error) => {
  console.error('应用错误', error)
}
app.mount('#app')
