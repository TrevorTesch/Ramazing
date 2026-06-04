self.__uv$config = {
  prefix: "/uv/service/",
  bare: "/bare/",
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: "/uv/uv.handler.js",
  client: "/uv/uv.client.js",
  bundle: "/uv/uv.bundle.js",
  config: "/uv/uv.config.js",
  sw: "/uv/uv.sw.js",
};

if (self.location.pathname != '/') {
  self._open = self.open;
  self.open = (url, title, _) => { parent.tabs.createTab(url, title); console.warn(`Replaced open correctly and opening new tab with src ${url}`) }
}

self.__ramazing = {
  erudaState: false,
  eruda: null
}

self.addEventListener("message", (e) => {
  if (e.data === "__ramazing$toggleEruda") {
    if (__ramazing.eruda._devTools && !__ramazing.eruda._devTools._isShow) {
      __ramazing.erudaState = true;
      __ramazing.eruda.show();
    } else if (__ramazing.erudaState) {
      __ramazing.erudaState = false;
      __ramazing.eruda.destroy();
    } else {
      __ramazing.erudaState = true;
      __ramazing.eruda.init();
      __ramazing.eruda.show();
    }
  }
})

self.onload = () => {
  if (typeof window === "object" && self.constructor === Window) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/eruda";
    script.onload = () => {
      self.__ramazing.eruda = eruda;
    }
    document.head.append(script);
    document.onclick = (e) => { if (e.target.id !== "__ramazing-search-bar") parent.postMessage("hide-suggestions"); }
    try {
      parent.updateOmni();
      parent.setTab();
      //Update history on everything EXCEPT for ramazing:// urls
      if (__uv) parent.tabs.updateHistory(__uv.location.href, document.title, `https://www.google.com/s2/favicons/imgs/icons?domain=${__uv.location.href}&sz=24`);
    } catch (e) {
      console.log(`[LOAD] Error in initializing tab: ${e}`);
    }
  }
}
