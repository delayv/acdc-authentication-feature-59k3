import{r as t,h as i,H as s,i as e,e as n}from"./p-3df3e749.js";import{a as o}from"./p-8a0d5290.js";import"./p-f4d641a6.js";const a=class{constructor(i){t(this,i),this.loaded=!1,this.active=!1}async componentWillLoad(){this.active&&await this.setActive()}async setActive(){await this.prepareLazyLoaded(),this.active=!0}changeActive(t){t&&this.prepareLazyLoaded()}prepareLazyLoaded(){if(!this.loaded&&null!=this.component){this.loaded=!0;try{return o(this.delegate,this.el,this.component,["ion-page"])}catch(t){console.error(t)}}return Promise.resolve(void 0)}render(){const{tab:t,active:e,component:n}=this;return i(s,{role:"tabpanel","aria-hidden":e?null:"true","aria-labelledby":`tab-button-${t}`,class:{"ion-page":void 0===n,"tab-hidden":!e}},i("slot",null))}get el(){return e(this)}static get watchers(){return{active:["changeActive"]}}};a.style=":host(.tab-hidden){display:none !important}";const h=class{constructor(i){t(this,i),this.ionNavWillLoad=n(this,"ionNavWillLoad",7),this.ionTabsWillChange=n(this,"ionTabsWillChange",3),this.ionTabsDidChange=n(this,"ionTabsDidChange",3),this.transitioning=!1,this.useRouter=!1,this.onTabClicked=t=>{const{href:i,tab:s}=t.detail;if(this.useRouter&&void 0!==i){const t=document.querySelector("ion-router");t&&t.push(i)}else this.select(s)}}async componentWillLoad(){if(this.useRouter||(this.useRouter=!!document.querySelector("ion-router")&&!this.el.closest("[no-router]")),!this.useRouter){const t=this.tabs;t.length>0&&await this.select(t[0])}this.ionNavWillLoad.emit()}componentWillRender(){const t=this.el.querySelector("ion-tab-bar");t&&(t.selectedTab=this.selectedTab?this.selectedTab.tab:void 0)}async select(t){const i=r(this.tabs,t);return!!this.shouldSwitch(i)&&(await this.setActive(i),await this.notifyRouter(),this.tabSwitch(),!0)}async getTab(t){return r(this.tabs,t)}getSelected(){return Promise.resolve(this.selectedTab?this.selectedTab.tab:void 0)}async setRouteId(t){const i=r(this.tabs,t);return this.shouldSwitch(i)?(await this.setActive(i),{changed:!0,element:this.selectedTab,markVisible:()=>this.tabSwitch()}):{changed:!1,element:this.selectedTab}}async getRouteId(){const t=this.selectedTab&&this.selectedTab.tab;return void 0!==t?{id:t,element:this.selectedTab}:void 0}setActive(t){return this.transitioning?Promise.reject("transitioning already happening"):(this.transitioning=!0,this.leavingTab=this.selectedTab,this.selectedTab=t,this.ionTabsWillChange.emit({tab:t.tab}),t.active=!0,Promise.resolve())}tabSwitch(){const t=this.selectedTab,i=this.leavingTab;this.leavingTab=void 0,this.transitioning=!1,t&&i!==t&&(i&&(i.active=!1),this.ionTabsDidChange.emit({tab:t.tab}))}notifyRouter(){if(this.useRouter){const t=document.querySelector("ion-router");if(t)return t.navChanged("forward")}return Promise.resolve(!1)}shouldSwitch(t){return void 0!==t&&t!==this.selectedTab&&!this.transitioning}get tabs(){return Array.from(this.el.querySelectorAll("ion-tab"))}render(){return i(s,{onIonTabButtonClick:this.onTabClicked},i("slot",{name:"top"}),i("div",{class:"tabs-inner"},i("slot",null)),i("slot",{name:"bottom"}))}get el(){return e(this)}},r=(t,i)=>{const s="string"==typeof i?t.find((t=>t.tab===i)):i;return s||console.error(`tab with id: "${s}" does not exist`),s};h.style=":host{left:0;right:0;top:0;bottom:0;display:-ms-flexbox;display:flex;position:absolute;-ms-flex-direction:column;flex-direction:column;width:100%;height:100%;contain:layout size style;z-index:0}.tabs-inner{position:relative;-ms-flex:1;flex:1;contain:layout size style}";export{a as ion_tab,h as ion_tabs}