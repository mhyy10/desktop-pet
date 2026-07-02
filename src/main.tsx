import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initSkinRegistry } from "./pet";
import { loadCustomSkins } from "./utils/customSkins";
import { registerCustomSkin } from "./pet/skinRegistry";

// 启动时初始化皮肤注册中心：注册内置皮肤 + localStorage 中的自定义皮肤
// 必须在 App 渲染前完成，否则 usePetRenderer 首次 getThemeById 时注册表为空
initSkinRegistry();
for (const skin of loadCustomSkins()) {
  registerCustomSkin(skin);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
