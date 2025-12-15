// ==========================================
// 1. EMBEDDED SOLVER ENGINE (No external file needed)
// ==========================================
const SOLVER_CODE = `
self.min2phase = {};
(function(t){"use strict";var o,n,s,e,u,r,f,i,a,h,c,l,v,d,b,p,m,y,w,g,_,x,M,S,j,P,A,B,C,k,E,T,D,I,O,U,L,R,F;function G(t,o,n){for(var s=0,e=0,u=n-1;0<=u;u--)s=t[e=o[u]]+n*s,t.splice(e,1);return s}function H(t,o,n,s){for(var e=new Array(n),u=0,r=0;r<n;r++){for(var f=t%s,i=n-1-r;0<=i;){if(u>>>i&1)i--;else{if(0==f)break;f--,i--}}e[i]=o[r],u|=1<<i,t=(t-f)/s,s--}return e}function J(t,o,n,s){for(var e=new Array(n),u=0;u<n;u++)e[u]=t[u];for(u=0;u<s;u++){var r=e[o+u],f=e[n-1-u];e[o+u]=f,e[n-1-u]=r}return e}function K(t,o){var n=t>>>3,s=t&7,e=o>>>3,u=o&7;return 5<=n&&5<=e&&n!=e&&Math.abs(n-e)!=3?1:0}function N(t){return t.replace(/\\s+/g,"")}function Q(t){for(var o=0;o<t.length;o++)if(0<=t[o]&&t[o]<18)return 1;return 0}o=0,n=1,s=2,e=3,u=4,r=5,f=0,i=1,a=2,h=3,c=4,l=5,v=6,d=7,b=0,p=1,m=2,y=3,w=4,g=5,_=6,x=7,M=8,S=9,j=10,P=11,A=[1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],B=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1],C=[0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],k=new Array(24),E=new Array(24),T=new Array(24),D=new Array(24),I=new Array(18),O=new Array(18),U=new Array(18),L=new Array(18),R=new Array(18),F=new Array(18),function(){for(var t=[[u,r,f,i,a,h],[i,a,h,u,r,f],[f,u,r,h,i,a]],o=0;o<3;o++){k[o]=t[o][0],E[o]=t[o][1],T[o]=t[o][2],D[o]=t[o][3],k[o+3]=t[o][4],E[o+3]=t[o][5],T[o+3]=t[o][3],D[o+3]=t[o][2],k[o+6]=t[o][0],E[o+6]=t[o][4],T[o+6]=t[o][5],D[o+6]=t[o][1],k[o+9]=t[o][2],E[o+9]=t[o][0],T[o+9]=t[o][1],D[o+9]=t[o][3],k[o+12]=t[o][3],E[o+12]=t[o][2],T[o+12]=t[o][5],D[o+12]=t[o][4],k[o+15]=t[o][1],E[o+15]=t[o][0],T[o+15]=t[o][4],D[o+15]=t[o][5],k[o+18]=t[o][5],E[o+18]=t[o][4],T[o+18]=t[o][2],D[o+18]=t[o][3],k[o+21]=t[o][4],E[o+21]=t[o][5],T[o+21]=t[o][3],D[o+21]=t[o][0]}for(var n=0;n<18;n++){I[n]=k[Math.floor(n/3)],O[n]=E[Math.floor(n/3)],U[n]=T[Math.floor(n/3)],L[n]=D[Math.floor(n/3)],R[n]=n%3==1,F[n]=n%3==2}}();var W=function(){function t(){this.cp=new Array(8),this.co=new Array(8),this.ep=new Array(12),this.eo=new Array(12)}return t}();function V(t,o,n){for(var s=0;s<8;s++)n.cp[s]=t.cp[o.cp[s]],n.co[s]=(t.co[o.cp[s]]+o.co[s])%3;for(s=0;s<12;s++)n.ep[s]=t.ep[o.ep[s]],n.eo[s]=(t.eo[o.ep[s]]+o.eo[s])%2}function Z(t,o,n){for(var s=0;s<8;s++)n.cp[s]=t.cp[o.cp[s]],n.co[s]=(t.co[o.cp[s]]+o.co[s])%3;for(s=0;s<12;s++)n.ep[s]=t.ep[o.ep[s]],n.eo[s]=(t.eo[o.ep[s]]+o.eo[s])%2}function $(t){for(var o=0;o<8;o++)t.co[o]=(t.co[o]+2)%3;for(o=0;o<12;o++)t.eo[o]=(t.eo[o]+1)%2}function q(t,o,n,s,e,u,r,f,i,a){var h=new W;return h.cp[0]=t,h.cp[1]=o,h.cp[2]=n,h.cp[3]=s,h.cp[4]=e,h.cp[5]=u,h.cp[6]=r,h.cp[7]=f,h.co[0]=i,h.co[1]=a,h.co[2]=a,h.co[3]=i,h.co[4]=a,h.co[5]=i,h.co[6]=i,h.co[7]=a,h}function z(t,o,n,s,e,u,r,f,i,a,h,c,l,v){var d=new W;return d.ep[0]=t,d.ep[1]=o,d.ep[2]=n,d.ep[3]=s,d.ep[4]=e,d.ep[5]=u,d.ep[6]=r,d.ep[7]=f,d.ep[8]=i,d.ep[9]=a,d.ep[10]=h,d.ep[11]=c,d.eo[0]=l,d.eo[1]=v,d.eo[2]=l,d.eo[3]=v,d.eo[4]=l,d.eo[5]=v,d.eo[6]=l,d.eo[7]=v,d.eo[8]=l,d.eo[9]=v,d.eo[10]=l,d.eo[11]=v,d}var X=new Array(6),Y=new Array(6);!function(){X[0]=q(3,0,1,2,4,5,6,7,0,0),X[1]=q(0,1,2,3,5,6,7,4,0,0),X[2]=q(0,6,1,3,4,5,2,7,0,1),X[3]=q(0,1,2,3,4,5,6,7,0,0),X[4]=q(0,1,2,3,4,5,6,7,0,0),X[5]=q(0,1,2,3,4,5,6,7,0,0),Y[0]=z(0,1,2,3,4,5,6,7,8,9,10,11,0,0),Y[1]=z(0,1,2,3,5,6,7,4,8,9,10,11,0,0),Y[2]=z(0,1,10,3,4,5,9,7,8,2,6,11,1,1),Y[3]=z(0,1,2,3,4,5,6,7,8,9,10,11,0,0),Y[4]=z(0,1,2,3,4,5,6,7,8,9,10,11,0,0),Y[5]=z(0,1,2,3,4,5,6,7,8,9,10,11,0,0);for(var t=0;t<6;t++)V(X[t],Y[t],X[t]);for(var o=new W,n=0;n<6;n++){for(var s=0;s<8;s++)o.cp[s]=X[n].cp[s],o.co[s]=X[n].co[s];for(s=0;s<12;s++)o.ep[s]=X[n].ep[s],o.eo[s]=X[n].eo[s];for(var e=0;e<2;e++)V(X[n],o,o),V(X[n],o,X[n])}}();var tt=function(){function t(){this.twist=0,this.tsym=0,this.flip=0,this.fsym=0,this.slice=0,this.prun=0}return t}(),ot=new Array(18);!function(){for(var t=new W,o=0;o<18;o++){ot[o]=new tt;for(var n=0;n<8;n++)t.cp[n]=n,t.co[n]=0;for(n=0;n<12;n++)t.ep[n]=n,t.eo[n]=0;for(var s=Math.floor(o/3),e=o%3,u=0;u<=e;u++)V(t,X[s],t);ot[o].twist=function(t){for(var o=0,n=0;n<7;n++)o=3*o+t[n];return o}(t.co),ot[o].flip=function(t){for(var o=0,n=0;n<11;n++)o=2*o+t[n];return o}(t.eo),ot[o].slice=function(t){for(var o=0,n=0,s=11;0<=s;s--)8<=t[s]&&(o+=n=(11-s-n)*(n+1)/2,n++);return o}(t.ep)}}();var nt=new Array(18);!function(){for(var t=new W,o=0;o<18;o++){nt[o]=new tt;for(var n=0;n<8;n++)t.cp[n]=n,t.co[n]=0;for(n=0;n<12;n++)t.ep[n]=n,t.eo[n]=0;for(var s=Math.floor(o/3),e=o%3,u=0;u<=e;u++)V(t,X[s],t);nt[o].twist=function(t){for(var o=0,n=0,s=6;0<=s;s--)o+=G(t,n,s+1)*(n=function(t){for(var o=1,n=1;n<=t;n++)o*=n;return o}(s+1));return o}(t.cp),nt[o].flip=function(t){for(var o=0,n=0,s=11;0<=s;s--)8<=t[s]&&(o+=n=(11-s-n)*(n+1)/2,n++);return o}(t.ep),nt[o].slice=function(t){for(var o=0,n=0,s=11;0<=s;s--)t[s]<=3&&(o+=n=(11-s-n)*(n+1)/2,n++);return o}(t.ep)}}();var st=new Int8Array(324),et=new Uint16Array(324),ut=new Uint16Array(336),rt=new Int8Array(336);function ft(t,o){for(var n=0;n<8;n++){var s=t&7;if(3!=s){var e=o>>2*s&3;return s+=(3-e)%3,(t&=~(7<<3*n))|s<<3*n}t>>=3}return t}function it(t,o,n,s){for(var e=0,u=0;u<n;u++){var r=t&1;t>>=1,s[u]=r,e+=r}var f=0,i=0;for(u=11;0<=u;u--)if(e<=11-u)s[u]=o%2,o>>=1,f+=s[u],i+=s[u]*Math.pow(2,u-8);else{if(s[u]=0,!(f<e))break;f++}return i}function at(t,o,n,s){for(var e=0,u=0;u<n;u++){var r=t&1;t>>=1,s[u]=r,e+=r}var f=0,i=0;for(u=0;u<12;u++)if(e<=11-u)s[u]=o%2,o>>=1,f+=s[u],i+=s[u]*Math.pow(2,u);else{if(s[u]=0,!(f<e))break;f++}return i}function ht(){var t,o,n=new W;for(t=0;t<8;t++)n.cp[t]=t;for(t=0;t<12;t++)n.ep[t]=t;for(t=0;t<16;t++){for(var s=new W,e=0;e<8;e++)s.cp[e]=n.cp[B[e^t]];for(e=0;e<12;e++)s.ep[e]=n.ep[C[e^t]];var u=st[16*ft(0,t)+t],r=function(t){for(var o=0,n=0,s=6;0<=s;s--)o+=G(t,n,s+1)*(n=function(t){for(var o=1,n=1;n<=t;n++)o*=n;return o}(s+1));return o}(s.cp);for(et[16*r+u]=t,o=0;o<16;o++)ut[16*r+o]=function(t,o){var n=new W;for(var s=0;s<8;s++)n.cp[s]=t.cp[o.cp[s]],n.co[s]=t.co[o.cp[s]];for(s=0;s<12;s++)n.ep[s]=t.ep[o.ep[s]],n.eo[s]=t.eo[o.ep[s]];return n}(s,function(t){for(var o=new W,n=0;n<8;n++)o.cp[n]=n;for(n=0;n<12;n++)o.ep[n]=n;for(var s=0;s<16;s++){var e=new W;for(n=0;n<8;n++)e.cp[n]=o.cp[B[n^s]];for(n=0;n<12;n++)e.ep[n]=o.ep[C[n^s]];if(function(t){for(var o=0,n=0,s=6;0<=s;s--)o+=G(t,n,s+1)*(n=function(t){for(var o=1,n=1;n<=t;n++)o*=n;return o}(s+1));return o}(e.cp)==t)return e}}(function(t){for(var o=0,n=0;n<7;n++)o=3*o+t[n];return o}(function(t,o){var n=new Array(8);return H(t,n,8,3),n}(0,t)))).co[0],rt[16*r+o]=st[16*ft(0,o)+t]}}!function(){for(var t=new W,o=0;o<8;o++)t.cp[o]=o;for(o=0;o<12;o++)t.ep[o]=o;for(o=0;o<16;o++){for(var n=new W,s=0;s<8;s++)n.cp[s]=t.cp[B[s^o]];for(s=0;s<12;s++)n.ep[s]=t.ep[C[s^o]];st[16*ft(0,o)+o]=function(t){for(var o=0,n=0,s=6;0<=s;s--)o+=G(t,n,s+1)*(n=function(t){for(var o=1,n=1;n<=t;n++)o*=n;return o}(s+1));return o}(n.cp)}}(),ht();var ct,lt,vt=null,dt=null,bt=null,pt=null,mt=null,yt=null,wt=null,gt=null,_t=null,xt=null,Mt=null,St=null,jt=null,Pt=null,At=null,Bt=new Int8Array(324),Ct=new Uint16Array(40320),kt=new Uint16Array(40320);function Et(t,o,n){var s,e,u,r,f,i,a=t.length,h=o.length,c=new Uint8Array(h*a);for(s=0;s<h;s++)for(e=0;e<a;e++)c[s*a+e]=255;for(s=0;s<n;s++)c[s*a]=0;var l=1,v=0;for(s=0;s<n;s++)for(e=0;e<a;e++)if(0==c[s*a+e])for(u=0;u<18;u++){var d=t[e][u],b=o[s][u],p=d&1023,m=d>>10;if(255==c[b*a+p]){if(c[b*a+p]=m^rt[16*l+ut[16*l+v]],v++,16==v&&(v=0,l++),l==n)return c;}}}function Tt(t,o){var n,s,e,u,r=t.length,f=new Int8Array(r);for(n=0;n<r;n++)f[n]=-1;f[o]=0;var i=0,a=1;for(n=0;n<r;n++)if(0==f[n])for(s=0;s<18;s++){var h=t[n][s];if(-1==f[h]){if(f[h]=1,i++,15==i&&(i=0,a++),a==16)return f;}}}function Dt(t,o){var n=t.length,s=new Int8Array(n/2);for(var e=0;e<n/2;e++)s[e]=-1;s[o>>1]=15^(o&1);var u=0,r=1;for(var e=0;e<n/2;e++){var f=s[e];if(-1!=f)for(var i=0;i<2;i++)if((f>>4*i&15)==(15^i))for(var a=0;a<18;a++){var h=t[(e<<1|i)][a],c=h>>1;if(s[c]==-1)s[c]=15^(h&1)<<4*(15^(h&1)^(1^i));else{var l=s[c];if((l>>4*(h&1)&15)==15)s[c]=l^(15^(h&1)^(1^i))<<4*(h&1);else if(u++,15==u&&(u=0,r++),r==16)return s}}}}function It(t,o,n){var s=t.length,e=new Int8Array(s/2);for(var u=0;u<s/2;u++)e[u]=-1;e[o>>1]=15^(o&1)<<4;var r=0,f=1;for(var u=0;u<s/2;u++){var i=e[u];if(-1!=i)for(var a=0;a<2;a++)if((i>>4*a&15)==(15^a))for(var h=0;h<18;h++){var c=t[u<<1|a][h],l=c>>1;if(e[l]==-1)e[l]=15^(c&1)<<4;else{var v=e[l];if((v>>4*(c&1)&15)==15)e[l]=v^(15^(c&1)^(1^a))<<4*(c&1);else if(r++,15==r&&(r=0,f++),f==16)return e}}}return e}var Ot=function(){function t(){this.init()}return t.prototype.init=function(){if(!ct){for(var t=0;t<324;t++)Bt[t]=-1;Bt[0]=0;for(var o=0;o<18;o++)Bt[ot[o].twist+16*ot[o].tsym]=1;for(var n=0;n<324;n++)if(0==Bt[n])for(o=0;o<18;o++){var s=st[n<<4|ot[o].tsym],e=ot[o].twist;if(-1==Bt[s+16*e]&&(Bt[s+16*e]=1,n<16))for(var u=0;u<2768;u++)if(u!=n&&0==Bt[u])for(var r=0;r<18;r++){var f=st[u<<4|ot[r].tsym],i=ot[r].twist;if(f+16*i==s+16*e){Bt[u]=1;break}}}ct=new Uint16Array(114688),lt=new Uint32Array(57344);for(var a=0;a<2187;a++)for(var h=0;h<16;h++){var c=st[16*a+h];Ct[16*a+et[c]]=c,kt[16*a+c]=et[c]}for(var l=0;l<2688;l++)ct[l]=l;for(var v=new Array(2187),d=0;d<2187;d++){v[d]=new Uint16Array(18);for(var b=0;b<18;b++){var p=st[d<<4|ot[b].tsym],m=ot[b].twist;v[d][b]=p+16*m}}vt=Et(v,function(){for(var t=new Array(495),o=0;o<495;o++){t[o]=new Uint16Array(18);for(var n=0;n<18;n++){var s=ot[n].slice;t[o][n]=s}}return t}(),168),dt=function(t,o,n){var s,e,u,r,f,i,a=t.length,h=o.length,c=new Uint32Array(h*a);for(s=0;s<h;s++)for(e=0;e<a;e++)c[s*a+e]=4294967295;for(s=0;s<n;s++)c[s*a]=0;var l=1,v=0;for(s=0;s<n;s++)for(e=0;e<a;e++)if(0==c[s*a+e])for(u=0;u<18;u++){var d=t[e][u],b=o[s][u],p=d&1023,m=d>>10;if(4294967295==c[b*a+p]){if(c[b*a+p]=m^rt[16*l+ut[16*l+v]],v++,16==v&&(v=0,l++),l==n)return c;}}}(v,function(){for(var t=new Array(2048),o=0;o<2048;o++){t[o]=new Uint16Array(18);for(var n=0;n<18;n++){var s=ot[n].flip,e=ot[n].fsym;t[o][n]=s<<10^e}}return t}(),64),bt=Tt(function(){for(var t=new Array(495),o=0;o<495;o++){t[o]=new Uint16Array(18);for(var n=0;n<18;n++){var s=nt[n].slice;t[o][n]=s}}return t}(),0),pt=Dt(function(){for(var t=new Array(40320),o=0;o<40320;o++){t[o]=new Uint16Array(18);for(var n=0;n<18;n++){var s=nt[n].twist;t[o][n]=s}}return t}(),0),mt=It(function(){for(var t=new Array(40320),o=0;o<40320;o++){t[o]=new Uint16Array(18);for(var n=0;n<18;n++){var s=nt[n].flip;t[o][n]=s}}return t}(),0),yt=new Int8Array(324);for(t=0;t<324;t++)yt[t]=-1;yt[0]=0;for(o=0;o<18;o++)yt[st[ot[o].tsym]]=1;wt=new Int8Array(324);for(t=0;t<324;t++)wt[t]=-1;wt[0]=0;for(o=0;o<18;o++)wt[ot[o].twist+16*ot[o].tsym]=1;gt=new Uint16Array(114688),_t=new Uint32Array(57344),xt=new Uint16Array(2688),Mt=new Uint32Array(2688),St=new Uint16Array(324);for(l=0;l<2688;l++)gt[l]=l;for(l=0;l<324;l++)St[l]=l;jt=function(t,o,n){var s,e,u,r,f,i,a=t.length,h=o.length,c=new Uint8Array(h*a);for(s=0;s<h;s++)for(e=0;e<a;e++)c[s*a+e]=255;for(s=0;s<n;s++)c[s*a]=0;var l=1,v=0;for(s=0;s<n;s++)for(e=0;e<a;e++)if(0==c[s*a+e])for(u=0;u<18;u++){var d=t[e][u],b=o[s][u],p=d&1023,m=d>>10;if(255==c[b*a+p]){if(c[b*a+p]=m^rt[16*l+ut[16*l+v]],v++,16==v&&(v=0,l++),l==n)return c;}}}(v,function(){for(var t=new Array(495),o=0;o<495;o++){t[o]=new Uint16Array(18);for(var n=0;n<18;n++){var s=ot[n].slice;t[o][n]=s}}return t}(),168),Pt=function(t,o,n){var s,e,u,r,f,i,a=t.length,h=o.length,c=new Uint32Array(h*a);for(s=0;s<h;s++)for(e=0;e<a;e++)c[s*a+e]=4294967295;for(s=0;s<n;s++)c[s*a]=0;var l=1,v=0;for(s=0;s<n;s++)for(e=0;e<a;e++)if(0==c[s*a+e])for(u=0;u<18;u++){var d=t[e][u],b=o[s][u],p=d&1023,m=d>>10;if(4294967295==c[b*a+p]){if(c[b*a+p]=m^rt[16*l+ut[16*l+v]],v++,16==v&&(v=0,l++),l==n)return c;}}}(v,function(){for(var t=new Array(2048),o=0;o<2048;o++){t[o]=new Uint16Array(18);for(var n=0;n<18;n++){var s=ot[n].flip,e=ot[n].fsym;t[o][n]=s<<10^e}}return t}(),64),At=function(t,o,n){var s,e,u,r,f,i,a=t.length,h=o.length,c=new Uint16Array(h*a);for(s=0;s<h;s++)for(e=0;e<a;e++)c[s*a+e]=65535;for(s=0;s<n;s++)c[s*a]=0;var l=1,v=0;for(s=0;s<n;s++)for(e=0;e<a;e++)if(0==c[s*a+e])for(u=0;u<18;u++){var d=t[e][u],b=o[s][u],p=d&1023,m=d>>10;if(65535==c[b*a+p]){if(c[b*a+p]=m^rt[16*l+ut[16*l+v]],v++,16==v&&(v=0,l++),l==n)return c;}}}(v,function(){for(var t=new Array(2688),o=0;o<2688;o++){t[o]=new Uint16Array(18);for(var n=0;n<18;n++){var s=ot[n].slice,e=ot[n].tsym;t[o][n]=s<<10^e}}return t}(),168)}},t.prototype.solution=function(t,o,n,s,e){for(var u=new W,r=0;r<8;r++)u.cp[r]=r;for(r=0;r<12;r++)u.ep[r]=r;var f="URFDLB",i=0,a=0,h=0;for(r=0;r<t.length;r++){var c=f.indexOf(t.charAt(r));if(c!=-1){var l=1;r+1<t.length&&(t.charAt(r+1)=="'"?(l=3,r++):t.charAt(r+1)=="2"&&(l=2,r++));for(var v=0;v<l;v++)V(u,X[c],u)}}var d=function(t){for(var o=new Array(8),n=0;n<8;n++)o[n]=t.co[n];return it(function(t){for(var o=0,n=0,s=6;0<=s;s--)o+=G(t,n,s+1)*(n=function(t){for(var o=1,n=1;n<=t;n++)o*=n;return o}(s+1));return o}(t.cp),function(t,o){for(var n=0,s=0;s<7;s++)n=3*n+t[s];return n}(o),8,3)}(u),b=function(t){for(var o=new Array(12),n=0;n<12;n++)o[n]=t.eo[n];return at(function(t){for(var o=0,n=0,s=11;0<=s;s--)t[s]<=3&&(o+=n=(11-s-n)*(n+1)/2,n++);return o}(t.ep),function(t,o){for(var n=0,s=0;s<11;s++)n=2*n+t[s];return n}(o),12,2)}(u),p=function(t){for(var o=0,n=0,s=11;0<=s;s--)8<=t[s]&&(o+=n=(11-s-n)*(n+1)/2,n++);return o}(u.ep),m=Math.min(o,21),y=s,w=0,g=new Array(31),_=new Array(31),x=new Array(31),M=new Array(31),S=new Array(31),j=new Array(31),P=new Array(31),A=new Array(31),B=new Array(31),C=new Array(31),k=new Array(31),E=0;for(g[0]=d,x[0]=b,S[0]=p,_[0]=st[d],M[0]=st[b],j[0]=st[p];;){var T=m-E,D=vt[d+2187*p],I=dt[b+2187*p];if(T<D||T<I)E--;else if(0==E)E=Math.max(D,I);else{if(0==D&&0==I&&0==E){var O=g[0],U=x[0],L=S[0];for(r=0;r<E;r++){var R=P[r],F=nt[R].twist,H=nt[R].flip,J=nt[R].slice;O=Ct[16*O+F],U=Ct[16*U+H],L=Ct[16*L+J]}if(0==pt[O>>1]&&0==mt[U>>1]&&0==bt[L])return function(t){for(var o="",n=0;n<t;n++)o+=" "+function(t){return"URFDLB".charAt(t/3)+(" 2'".charAt(t%3))}(P[n]);return o.trim()}(E)}if(0<n&&w>=n)return null;if(E<m){for(P[E]=0;P[E]<18;P[E]++){var K=P[E],N=ot[K].twist,Q=ot[K].flip,W=ot[K].slice,V=st[d+16*N]^_[E+1],Z=st[b+16*Q]^M[E+1],$=st[p+16*W]^j[E+1];if(g[E+1]=Ct[16*g[E]+et[V]],x[E+1]=Ct[16*x[E]+et[Z]],S[E+1]=Ct[16*S[E]+et[$]],_[E+1]=V,M[E+1]=Z,j[E+1]=$,E++,w++,0==E)return null;E--}E--}else E--}}},t}();var Ut=new Ot;t.initTables=function(){Ut.init()},t.Search=Ot}(this.min2phase=this.min2phase||{}));

let isReady = false;
try { self.min2phase.initTables(); isReady = true; self.postMessage({type:'status',text:'ready'}); } catch(e){}

self.onmessage = function(e) {
    if (!isReady) { self.postMessage({type:'error',message:'Loading...'}); return; }
    try {
        const result = new self.min2phase.Search().solution(e.data, 21, 100000000, 0, 0);
        self.postMessage({type:'solution',solution:result});
    } catch(err) { self.postMessage({type:'error',message:err.message}); }
};
`;

// Create the Worker from the string above
const blob = new Blob([SOLVER_CODE], {type: 'application/javascript'});
const worker = new Worker(URL.createObjectURL(blob));

// ==========================================
// 2. CONFIGURATION & LOGIC
// ==========================================
const colors = { 'U':0xFFFFFF, 'R':0xB90000, 'F':0x009E60, 'D':0xFFD500, 'L':0xFF5800, 'B':0x0051BA, 'Core':0x151515 };
function getColorChar(h){let m=Infinity,c=null,r=(h>>16)&255,g=(h>>8)&255,b=h&255;for(let[k,v]of Object.entries(colors)){if(k=='Core')continue;let d=Math.abs(r-((v>>16)&255))+Math.abs(g-((v>>8)&255))+Math.abs(b-(v&255));if(d<m){m=d;c=k}}return c}

let scene,camera,renderer,raycaster,mouse,cubes=[],pivotGroup,isAnimating=false,paintColor='U',solutionMoves=[],moveIndex=0;
let isDragging=false,isMouseDown=false,previousMousePosition={x:0,y:0};

const statusEl = document.getElementById('status');
statusEl.innerText = "Loading Engine..."; statusEl.style.color = "orange";

worker.onmessage = function(e) {
    const data = e.data;
    if (data.type === 'status' && data.text === 'ready') {
        statusEl.innerText = "Ready! Paint & Solve."; statusEl.style.color = "#00ff00";
    } else if (data.type === 'solution') {
        let res = data.solution;
        if (res == null) { statusEl.innerText = "Error"; statusEl.style.color = "red"; alert("Unsolvable State"); }
        else if (res === "") { statusEl.innerText = "Already Solved!"; statusEl.style.color = "#00ff00"; }
        else {
            res = res.trim();
            statusEl.innerHTML = `SOLVED! (${res.split(/\s+/).length} moves)`; statusEl.style.color = "#00ff00";
            parseSolution(res);
            document.getElementById('action-controls').style.display='none';
            document.getElementById('playback-controls').style.display='flex';
        }
    } else if (data.type === 'error') { alert(data.message); }
};

init(); animate();

function init(){
    const c=document.getElementById('canvas-container');
    scene=new THREE.Scene(); scene.background=new THREE.Color(0x1a1a1a);
    camera=new THREE.PerspectiveCamera(45,window.innerWidth/window.innerHeight,0.1,100); camera.position.set(0,0,11); camera.lookAt(0,0,0);
    renderer=new THREE.WebGLRenderer({antialias:true}); renderer.setSize(window.innerWidth,window.innerHeight); renderer.setPixelRatio(window.devicePixelRatio); c.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff,0.6));
    const dl=new THREE.DirectionalLight(0xffffff,1); dl.position.set(10,20,10); scene.add(dl);
    raycaster=new THREE.Raycaster(); mouse=new THREE.Vector2();
    ['mousedown','mousemove','mouseup','touchstart','touchmove','touchend'].forEach(e=>document.addEventListener(e,handleInput,{passive:false}));
    pivotGroup=new THREE.Group(); scene.add(pivotGroup); createRubiksCube();
    pivotGroup.rotation.x=0.3; pivotGroup.rotation.y=-0.4;
}

function createRubiksCube(){
    const g=new THREE.BoxGeometry(0.96,0.96,0.96);
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
        const mats=[
            new THREE.MeshPhongMaterial({color:x==1?colors.R:colors.Core}), new THREE.MeshPhongMaterial({color:x==-1?colors.L:colors.Core}),
            new THREE.MeshPhongMaterial({color:y==1?colors.U:colors.Core}), new THREE.MeshPhongMaterial({color:y==-1?colors.D:colors.Core}),
            new THREE.MeshPhongMaterial({color:z==1?colors.F:colors.Core}), new THREE.MeshPhongMaterial({color:z==-1?colors.B:colors.Core})
        ];
        const m=new THREE.Mesh(g,mats); m.position.set(x,y,z);
        m.userData={initialX:x,initialY:y,initialZ:z,isCenter:(Math.abs(x)+Math.abs(y)+Math.abs(z))===1};
        pivotGroup.add(m); cubes.push(m);
    }
}

function selectColor(el,c){paintColor=c;document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('selected'));el.classList.add('selected')}

function handleInput(e){
    if(e.type==='mousedown'||e.type==='touchstart'){isMouseDown=true;isDragging=false;previousMousePosition={x:e.clientX||e.touches[0].clientX,y:e.clientY||e.touches[0].clientY}}
    else if(e.type==='mousemove'||e.type==='touchmove'){
        if(!isMouseDown)return;
        const x=e.clientX||e.touches[0].clientX, y=e.clientY||e.touches[0].clientY;
        if(Math.abs(x-previousMousePosition.x)>2||Math.abs(y-previousMousePosition.y)>2)isDragging=true;
        if(isDragging){e.preventDefault();pivotGroup.rotation.y+=(x-previousMousePosition.x)*0.005;pivotGroup.rotation.x+=(y-previousMousePosition.y)*0.005}
        previousMousePosition={x,y};
    }
    else if(e.type==='mouseup'||e.type==='touchend'){
        isMouseDown=false;
        if(!isDragging){
            const x=e.clientX||(e.changedTouches[0]?e.changedTouches[0].clientX:0), y=e.clientY||(e.changedTouches[0]?e.changedTouches[0].clientY:0);
            if(x===0&&y===0)return;
            mouse.x=(x/window.innerWidth)*2-1; mouse.y=-(y/window.innerHeight)*2+1;
            raycaster.setFromCamera(mouse,camera);
            const hits=raycaster.intersectObjects(cubes);
            if(hits.length>0){
                const h=hits[0];
                if(h.object.userData.isCenter){alert("⚠️ Centers Fixed! Green Front, White Top.");return}
                if(h.object.material[h.face.materialIndex].color.getHex()!==colors.Core) h.object.material[h.face.materialIndex].color.setHex(colors[paintColor]);
            }
        }
    }
}

function solveCube(){
    let s="";
    // U R F D L B
    [[[-1,1,-1],[0,1,-1],[1,1,-1],[-1,1,0],[0,1,0],[1,1,0],[-1,1,1],[0,1,1],[1,1,1]],
     [[1,1,1],[1,1,0],[1,1,-1],[1,0,1],[1,0,0],[1,0,-1],[1,-1,1],[1,-1,0],[1,-1,-1]],
     [[-1,1,1],[0,1,1],[1,1,1],[-1,0,1],[0,0,1],[1,0,1],[-1,-1,1],[0,-1,1],[1,-1,1]],
     [[-1,-1,1],[0,-1,1],[1,-1,1],[-1,-1,0],[0,-1,0],[1,-1,0],[-1,-1,-1],[0,-1,-1],[1,-1,-1]],
     [[-1,1,-1],[-1,1,0],[-1,1,1],[-1,0,-1],[-1,0,0],[-1,0,1],[-1,-1,-1],[-1,-1,0],[-1,-1,1]],
     [[1,1,-1],[0,1,-1],[-1,1,-1],[1,0,-1],[0,0,-1],[-1,0,-1],[1,-1,-1],[0,-1,-1],[-1,-1,-1]]
    ].forEach((f,i)=>{f.forEach(p=>{const c=cubes.find(m=>m.userData.initialX==p[0]&&m.userData.initialY==p[1]&&m.userData.initialZ==p[2]);s+=getColorChar(c.material[[2,0,4,3,1,5][i]].color.getHex())})});
    
    console.log("Captured:",s);
    statusEl.innerText="Analyzing..."; statusEl.style.color="orange";
    worker.postMessage(s);
}

function parseSolution(s){solutionMoves=[];const p=s.split(/\s+/);p.forEach(m=>m&&solutionMoves.push(m));moveIndex=0}
function nextMove(){if(moveIndex<solutionMoves.length){rotateFace(solutionMoves[moveIndex]);moveIndex++;document.getElementById('status').innerHTML=`Move ${moveIndex}/${solutionMoves.length}: <b style="color:#fff;font-size:24px">${solutionMoves[moveIndex-1]}</b>`}else{document.getElementById('status').innerText="Cube Solved!"}}
function prevMove(){}
let playInterval;
function togglePlay(){if(playInterval){clearInterval(playInterval);playInterval=null;document.getElementById('playPauseBtn').innerText="PLAY"}else{document.getElementById('playPauseBtn').innerText="PAUSE";playInterval=setInterval(()=>{if(!isAnimating&&moveIndex<solutionMoves.length)nextMove()},600)}}
function resetCube(){location.reload()}
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera)}

function rotateFace(move){
    if(isAnimating)return;isAnimating=true;
    const base=move[0],isPrime=move.includes("'"),isDouble=move.includes("2");
    let axis='y',dir=-1,angle=Math.PI/2;
    if(isPrime)dir=1;if(isDouble){angle=Math.PI;dir=-1}
    let group=[];
    cubes.forEach(c=>{
        const p=c.position;
        if(base=='R'&&p.x>0.1){axis='x';group.push(c)}
        if(base=='L'&&p.x<-0.1){axis='x';group.push(c);dir*=-1}
        if(base=='U'&&p.y>0.1){axis='y';group.push(c)}
        if(base=='D'&&p.y<-0.1){axis='y';group.push(c);dir*=-1}
        if(base=='F'&&p.z>0.1){axis='z';group.push(c)}
        if(base=='B'&&p.z<-0.1){axis='z';group.push(c);dir*=-1}
    });
    const pivot=new THREE.Object3D(); pivotGroup.add(pivot); group.forEach(c=>pivot.attach(c));
    const target=angle*dir,dur=isDouble?400:250,start=Date.now();
    function loop(){
        const p=Math.min((Date.now()-start)/dur,1);
        pivot.rotation[axis]=target*(1-Math.pow(1-p,3));
        if(p<1)requestAnimationFrame(loop);
        else{
            pivot.rotation[axis]=target;pivot.updateMatrixWorld();
            group.forEach(c=>{pivotGroup.attach(c);c.position.round();c.rotation.set(Math.round(c.rotation.x/(Math.PI/2))*(Math.PI/2),Math.round(c.rotation.y/(Math.PI/2))*(Math.PI/2),Math.round(c.rotation.z/(Math.PI/2))*(Math.PI/2));c.updateMatrix()});
            pivotGroup.remove(pivot);isAnimating=false;
        }
    }
    loop();
}
