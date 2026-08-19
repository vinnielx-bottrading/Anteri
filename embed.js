/*!
 * Anteri Community Chat — embed loader
 * Dán đoạn <script> tương ứng vào bất kỳ website nào để hiện nút chat góc phải màn hình.
 * Sử dụng:
 *   <script src="https://TEN-HOST-CUA-BAN/embed.js"
 *           data-backend="https://anteri.onrender.com"
 *           async></script>
 * Yêu cầu: file này và chat-plugin.html phải được host CÙNG một thư mục/domain.
 */
(function () {
  "use strict";

  var CLOSED_SIZE = 76;      // px, kích thước iframe khi đóng (chỉ hiện nút launcher)
  var OPEN_WIDTH = 400;      // px, chiều rộng khi mở trên desktop
  var OPEN_HEIGHT = 680;     // px, chiều cao khi mở trên desktop
  var MOBILE_BREAKPOINT = 640;

  var thisScript = document.currentScript;
  if (!thisScript) {
    var scripts = document.getElementsByTagName("script");
    thisScript = scripts[scripts.length - 1];
  }

  var backend = thisScript.getAttribute("data-backend") || "";
  var zIndex = thisScript.getAttribute("data-z-index") || "999999";
  if (!backend) {
    console.error("[Anteri Chat] Thiếu data-backend trên thẻ <script>. Vd: data-backend=\"https://anteri.onrender.com\"");
    return;
  }

  var baseUrl = thisScript.src.replace(/embed\.js(\?.*)?$/, "");
  var src = baseUrl + "chat-plugin.html?embed=1&backend=" + encodeURIComponent(backend);

  var iframe = document.createElement("iframe");
  iframe.title = "Chat";
  iframe.src = src;
  iframe.setAttribute("allowtransparency", "true");
  iframe.style.cssText = [
    "position:fixed",
    "right:20px",
    "bottom:20px",
    "left:auto",
    "top:auto",
    "width:" + CLOSED_SIZE + "px",
    "height:" + CLOSED_SIZE + "px",
    "border:0",
    "border-radius:50%",
    "box-shadow:none",
    "z-index:" + zIndex,
    "transition:width .25s ease,height .25s ease,border-radius .25s ease",
    "background:transparent",
    "color-scheme:light"
  ].join(";");

  function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function applyOpenLayout() {
    if (isMobile()) {
      iframe.style.right = "0";
      iframe.style.left = "0";
      iframe.style.bottom = "0";
      iframe.style.top = "0";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.borderRadius = "0";
    } else {
      iframe.style.right = "20px";
      iframe.style.left = "auto";
      iframe.style.bottom = "20px";
      iframe.style.top = "auto";
      iframe.style.width = OPEN_WIDTH + "px";
      iframe.style.height = OPEN_HEIGHT + "px";
      iframe.style.borderRadius = "22px";
    }
    iframe.style.boxShadow = "0 20px 60px rgba(20,30,50,.25)";
  }

  function applyClosedLayout() {
    iframe.style.right = "20px";
    iframe.style.left = "auto";
    iframe.style.bottom = "20px";
    iframe.style.top = "auto";
    iframe.style.width = CLOSED_SIZE + "px";
    iframe.style.height = CLOSED_SIZE + "px";
    iframe.style.borderRadius = "50%";
    iframe.style.boxShadow = "none";
  }

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.source !== "anteri-chat-widget" || d.type !== "resize") return;
    if (d.open) applyOpenLayout();
    else applyClosedLayout();
  });

  function mount() {
    document.body.appendChild(iframe);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
