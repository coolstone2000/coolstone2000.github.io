(function () {
  'use strict';
  const NS='http://www.w3.org/2000/svg', TAU=2*Math.PI;
  const seq=(a,b,f)=>Array.from({length:b-a+1},(_,i)=>[i+a,f(i+a)]);
  const samples=(f,a,b,n=400)=>Array.from({length:n+1},(_,i)=>{const x=a+(b-a)*i/n;return [x,f(x)];});
  const sinc=x=>Math.abs(x)<1e-10?1:Math.sin(Math.PI*x)/(Math.PI*x);
  const fmt=x=>Math.abs(x)<1e-8?'0':Number(x.toFixed(2)).toString();
  function el(tag,attrs={},text) {const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(text!==undefined)e.textContent=text;return e;}
  document.querySelectorAll('.ssv-root:not([data-ready])').forEach((root,index)=>{
    root.dataset.ready='1';const body=root.querySelector('.ssv-body'),kind=root.dataset.kind;
    const controls=document.createElement('div');controls.className='ssv-controls';body.append(controls);
    const plots=document.createElement('div');plots.className='ssv-grid';body.append(plots);
    const note=document.createElement('p');note.className='ssv-note';note.setAttribute('role','status');body.append(note);
    let draw=()=>{};let chartCount=0;
    function slider(label,min,max,step,value) {
      const l=document.createElement('label'),o=document.createElement('output'),input=document.createElement('input');
      l.append(document.createTextNode(label+' '),o);input.type='range';Object.assign(input,{min,max,step,value});l.append(input);controls.append(l);
      const update=()=>{o.value=fmt(Number(input.value));draw();};input.addEventListener('input',update);o.value=fmt(Number(input.value));return ()=>Number(input.value);
    }
    function select(label,options) {
      const l=document.createElement('label'),s=document.createElement('select');l.append(document.createTextNode(label));
      options.forEach(([value,text])=>{const o=document.createElement('option');o.value=value;o.textContent=text;s.append(o);});l.append(s);controls.append(l);s.addEventListener('change',()=>draw());return ()=>s.value;
    }
    function chart(title,parent=plots,square=false) {
      const spanY=square?482:186, bottom=36+spanY;
      const panel=document.createElement('div');panel.className='ssv-panel';const h=document.createElement('h5');h.textContent=title;
      const scroll=document.createElement('div');scroll.className='ssv-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',title+' — 가로 스크롤 가능');
      const svg=el('svg',{viewBox:'0 0 560 '+(bottom+48),class:'ssv-plot',role:'img','aria-label':title});scroll.append(svg);
      const legend=document.createElement('div');legend.className='ssv-legend';panel.append(h,scroll,legend);parent.append(panel);
      const id='ssv-clip-'+index+'-'+chartCount++;
      return (series,range,xlabel='t (s)',ylabel='진폭',ticks=null)=>{
        const [xmin,xmax,ymin,ymax]=range,X=x=>58+(x-xmin)/(xmax-xmin)*482,Y=y=>bottom-(y-ymin)/(ymax-ymin)*spanY;
        const base=Y(Math.max(ymin,Math.min(ymax,0)));svg.replaceChildren(el('title',{},title));legend.replaceChildren();
        const defs=el('defs'),clip=el('clipPath',{id});clip.append(el('rect',{x:58,y:36,width:482,height:spanY}));defs.append(clip);svg.append(defs);
        const xt=ticks||Array.from({length:5},(_,i)=>[xmin+(xmax-xmin)*i/4,fmt(xmin+(xmax-xmin)*i/4)]);
        for(let i=0;i<=4;i++){const y=ymin+(ymax-ymin)*i/4;svg.append(el('line',{x1:58,y1:Y(y),x2:540,y2:Y(y),class:'ssv-gridline'}),el('text',{x:50,y:Y(y)+4,'text-anchor':'end'},fmt(y)));}
        xt.forEach(([x,label])=>{svg.append(el('line',{x1:X(x),y1:36,x2:X(x),y2:bottom,class:'ssv-gridline'}),el('text',{x:X(x),y:bottom+20,'text-anchor':'middle'},label));});
        svg.append(el('line',{x1:58,y1:base,x2:540,y2:base,class:'ssv-axis'}),el('line',{x1:X(Math.max(xmin,Math.min(xmax,0))),y1:36,x2:X(Math.max(xmin,Math.min(xmax,0))),y2:bottom,class:'ssv-axis'}),el('text',{x:58,y:20},ylabel),el('text',{x:540,y:bottom+40,'text-anchor':'end'},xlabel));
        const g=el('g',{'clip-path':'url(#'+id+')'});svg.append(g);
        series.forEach(s=>{
          const color='var(--ss-'+(s.color||'blue')+')',pts=s.points;
          if(s.type==='stem'||s.type==='points'||s.type==='impulse')pts.forEach(([x,y])=>{
            if(s.type!=='points')g.append(el('line',{x1:X(x),y1:base,x2:X(x),y2:Y(y),stroke:color,'stroke-width':2}));
            if(s.type==='impulse')g.append(el('path',{d:`M${X(x)-5},${Y(y)+8} L${X(x)},${Y(y)} L${X(x)+5},${Y(y)+8}`,fill:'none',stroke:color,'stroke-width':2}));
            else g.append(el('circle',{cx:X(x),cy:Y(y),r:3,fill:color}));
          });
          else g.append(el('path',{d:pts.map(([x,y],i)=>(i?'L':'M')+X(x).toFixed(2)+','+Y(y).toFixed(2)).join(' '),fill:'none',stroke:color,'stroke-width':2.4,'stroke-dasharray':s.dashed?'6 5':'none'}));
          if(s.label){const item=document.createElement('span');item.style.setProperty('--series',color);item.textContent=s.label;legend.append(item);}
        });
      };
    }
    const line=(f,a,b,label,color='blue')=>({points:samples(f,a,b),label,color});
    const stem=(p,label,color='amber')=>({points:p,label,color,type:'stem'});
    const one=title=>{plots.style.gridTemplateColumns='minmax(0,1fr)';return chart(title);};
    if(kind==='signal-flow') {
      plots.className='ssv-flow';['물리량','센서','아날로그 필터','ADC: 샘플링·양자화','DSP','DAC·복원 필터','출력'].forEach((x,i)=>{if(i)plots.append(document.createTextNode('→'));const e=document.createElement('span');e.className='ssv-node';e.textContent=x;plots.append(e);});
      note.textContent='입력 필터는 aliasing을 줄이고, 출력 복원 필터는 DAC 뒤의 스펙트럼 복제 성분을 줄인다.';
    } else if(['constant','step','impulse','ramp','exp','complex-exp','sin'].includes(kind)) {
      if(kind==='constant'){const a=slider('진폭 A',-2,2,.1,1),p=one('상수 신호');draw=()=>{p([line(()=>a(),-2,3,'x(t) = A')],[-2,3,-2.5,2.5]);note.textContent='A = '+fmt(a())+' : 시간에 따라 바뀌지 않는 DC 성분.';};}
      if(kind==='step'){const t=slider('켜지는 시각 t₀ (s)',-1,2,.1,0),p=one('단위 계단 u(t − t₀)');draw=()=>{p([{points:[[-2,0],[t(),0],[t(),1],[3,1]],label:'단위 계단'}],[-2,3,-.25,1.25]);note.textContent='t < '+fmt(t())+'에서는 0, t > '+fmt(t())+'에서는 1. 수직선은 점프를 표시한다. 불연속점의 값은 별도 관례다.';};}
      if(kind==='impulse'){const e=slider('근사 펄스 폭 ε (s)',.1,1,.1,.5),p=one('면적 1인 펄스로 보는 Dirac 임펄스');draw=()=>{p([{points:[[-1,0],[-e()/2,0],[-e()/2,1/e()],[e()/2,1/e()],[e()/2,0],[1,0]],label:'직사각형 근사 δε(t)'}],[-1,1,0,11]);note.textContent='폭 '+fmt(e())+' × 높이 '+fmt(1/e())+' = 면적 1. ε→0의 분포 극한이 δ(t)이며, 높이 1인 보통 함수가 아니다.';};}
      if(kind==='ramp'){const p=one('램프 r(t) = t u(t)');draw=()=>{p([{points:[[-2,0],[0,0],[3,3]],label:'램프'}],[-2,3,-.3,3.3]);note.textContent='t < 0에서는 0, t > 0에서는 기울기 1. 원점에서 미분 가능하지 않으며 미분 관계는 거의 모든 점 또는 분포의 의미로 읽는다.';};}
      if(kind==='exp'){const a=slider('지수 a (s⁻¹)',-1,1,.1,-.5),p=one('양방향 실수 지수 x(t) = exp(at)');draw=()=>{p([line(t=>Math.exp(a()*t),-2,3,'exp(at)')],[-2,3,0,21]);note.textContent='a = '+fmt(a())+' : '+(a()<0?'앞으로 갈수록 감쇠하지만 음의 시간에서는 커진다.':a()>0?'앞으로 갈수록 성장한다.':'exp(0t) = 1이다.')+' u(t)를 곱한 인과적 지수와 구분하자.';};}
      if(kind==='complex-exp'){const phase=slider('위상 θ (rad)',0,6.28,.01,0),p=chart('복소평면의 단위원',plots,true),q=chart('실수부와 허수부');draw=()=>{p([line(x=>Math.sqrt(Math.max(0,1-x*x)),-1,1,'단위원'),line(x=>-Math.sqrt(Math.max(0,1-x*x)),-1,1,''),{points:[[0,0],[Math.cos(phase()),Math.sin(phase())]],color:'amber',label:'exp(jθ)'}],[-1.25,1.25,-1.25,1.25],'실수부','허수부');q([line(t=>Math.cos(t),0,TAU,'cos θ'),line(t=>Math.sin(t),0,TAU,'sin θ','amber'),{points:[[phase(),Math.cos(phase())],[phase(),Math.sin(phase())]],type:'points',color:'red'}],[0,TAU,-1.25,1.25],'θ (rad)');note.textContent='θ = '+fmt(phase())+' rad : 실수부 '+fmt(Math.cos(phase()))+', 허수부 '+fmt(Math.sin(phase()))+'. 복소지수의 크기는 항상 1이다.';};}
      if(kind==='sin'){const f=slider('주파수 f₀ (Hz)',.5,3,.1,1),ph=slider('위상 φ (rad)',-3.14,3.14,.01,0),p=one('x(t) = cos(2πf₀t + φ)');draw=()=>{p([line(t=>Math.cos(TAU*f()*t+ph()),-1,2,'코사인')],[-1,2,-1.25,1.25]);note.textContent='주기 T₀ = '+fmt(1/f())+' s, 각주파수 Ω₀ = '+fmt(TAU*f())+' rad/s. 위상은 수평 위치를 바꾼다.';};}
    } else if(['dt-impulse','dt-step'].includes(kind)) {
      const p=one(kind==='dt-step'?'이산 단위계단':'이산 단위샘플');draw=()=>{p([stem(seq(-5,5,n=>kind==='dt-step'?(n>=0?1:0):(n===0?1:0)),'정수 위치의 샘플')],[-5,5,-.2,1.2],'n (sample)');note.textContent='점 사이의 값은 정의하지 않는다. δ[n]은 n=0에서 값 1이고 전체 합이 1이다.';};
    } else if(kind==='fourier-synthesis') {
      const count=slider('더할 홀수 고조파 개수',1,20,1,1);
      const p=chart('사인파를 더해 구형파에 접근하기'),q=chart('이번 부분합의 사인 계수 bₖ');
      draw=()=>{
        const n=count(),sum=t=>{let y=0;for(let m=0;m<n;m++){const k=2*m+1;y+=4*Math.sin(TAU*k*t)/(Math.PI*k);}return y;};
        const target=[[-.5,-1],[0,-1],[0,1],[.5,1],[.5,-1],[1,-1],[1,1],[1.5,1]];
        p([{points:target,label:'목표 구형파 (점프는 연결선)',dashed:true}, {points:samples(sum,-.5,1.5,1600),label:'고조파 '+n+'개 부분합',color:'amber'}],[-.5,1.5,-1.4,1.4],'t / T₀');
        q([stem(seq(1,39,k=>k%2===1&&k<=2*n-1?4/(Math.PI*k):0),'bₖ = 4/(πk), 포함한 홀수 k')],[0,40,0,1.4],'고조파 차수 k','사인 계수');
        note.textContent='최고 차수 '+(2*n-1)+'. 각 사인파의 진폭은 4/(πk)이며 복소 급수 계수 cₖ와 구분한다. 점프점에서 부분합은 0이다. 항을 늘리면 점프 주변의 오버슈트 폭이 좁아지지만 최대 높이는 0으로 사라지지 않는다.';
      };
    } else if(kind==='ct-dt') {
      const r=slider('한 주기당 샘플 수',3,20,1,8),p=chart('연속시간 x(t)'),q=chart('이산시간 x[n] = x(nTₛ)');draw=()=>{p([line(t=>Math.sin(TAU*t),0,2,'1 Hz 사인파')],[0,2,-1.25,1.25]);q([stem(seq(0,2*r(),n=>Math.sin(TAU*n/r())),'샘플')],[0,2*r(),-1.25,1.25],'n (sample)');note.textContent='fₛ = '+r()+' Hz, Tₛ = '+fmt(1/r())+' s. 두 그림의 시간 길이는 2초로 같다.';};
    } else if(['amplitude','time-shift','time-reverse','time-scale'].includes(kind)) {
      const v=kind==='amplitude'?slider('진폭 배율 A',-2,2,.1,1):kind==='time-shift'?slider('지연 t₀ (s)',-2,2,.1,1):kind==='time-scale'?slider('시간 배율 a',.3,3,.1,2):()=>-1;
      const p=one('원 신호와 변환 신호'),base=t=>Math.max(0,1-Math.abs(t-.5)/1.5);
      draw=()=>{const f=kind==='amplitude'?(t=>v()*base(t)):kind==='time-shift'?(t=>base(t-v())):kind==='time-reverse'?(t=>base(-t)):(t=>base(v()*t));
        p([line(base,-4,4,'원 신호 x(t)'),line(f,-4,4,'변환 신호','amber')],[-4,4,kind==='amplitude'?-2.2:-.2,kind==='amplitude'?2.2:1.2]);
        note.textContent=kind==='amplitude'?'진폭만 '+fmt(v())+'배. 시간 위치는 그대로이며 음수이면 위아래가 뒤집힌다.':kind==='time-shift'?'y(t)=x(t−t₀). t₀='+fmt(v())+' s: 양수이면 오른쪽, 음수이면 왼쪽으로 이동한다.':kind==='time-reverse'?'원 신호의 꼭짓점 +0.5 s가 −0.5 s로 이동한다. 비대칭 신호로 시간 반전을 확인하자.':'a='+fmt(v())+': 원래 폭 3 s → '+fmt(3/v())+' s. 여기서는 양의 배율만 조절하고 반전은 위에서 별도로 다룬다.';
      };
    } else if(kind==='transform') {
      const a=slider('시간 배율 a',-3,3,.1,1),b=slider('인수 이동 b',-3,3,.1,0),p=one('원 신호와 y(t) = x(at − b)');
      const base=t=>Math.max(0,1-Math.abs(t-.5)/1.5);draw=()=>{p([line(base,-6,6,'원 신호 x(t)','blue'),line(t=>base(a()*t-b()),-6,6,'변환 y(t)','amber')],[-6,6,-.2,1.2]);note.textContent=a()===0?'a=0: 시간 압축이 아니라 상수 x(−b)가 된다.':'원 신호의 꼭짓점 t=0.5 → 새 위치 t='+fmt((.5+b())/a())+'. '+(a()<0?'음의 배율이므로 반전도 포함한다.':'|a|가 클수록 폭이 좁아진다.')+' 화면 밖의 부분은 생략된다.';};
    } else if(kind==='convolution') {
      const t=slider('이동 t (s)',-1,3,.05,.5),p=chart('적분변수 τ에서 두 펄스의 겹침'),q=chart('겹친 면적 = 출력 y(t)');const rect=x=>x>=0&&x<=1?1:0,y=t=>Math.max(0,Math.min(1,t)-Math.max(0,t-1));draw=()=>{p([{points:[[-1,0],[0,0],[0,1],[1,1],[1,0],[3,0]],label:'x(τ)'},{points:[[-1,0],[t()-1,0],[t()-1,1],[t(),1],[t(),0],[3,0]],color:'amber',label:'h(t−τ)'}],[-1,3,-.2,1.3],'τ (s)');q([line(y,-1,3,'전체 출력'),{points:[[t(),y(t())]],type:'stem',color:'red',label:'현재 t'}],[-1,3,-.2,1.3]);note.textContent='t = '+fmt(t())+' s, 겹치는 구간 길이 = y(t) = '+fmt(y(t()))+'. 높이가 둘 다 1이므로 겹친 길이가 곱의 적분이다.';};
    } else if(['rc-step','rc-frequency'].includes(kind)) {
      const rc=slider('시정수 τ = RC (s)',.2,2,.1,.7),p=one(kind==='rc-step'?'RC 단위계단 응답':'RC 크기응답');draw=()=>{if(kind==='rc-step')p([line(t=>t<0?0:1-Math.exp(-t/rc()),-1,6,'y(t)')],[-1,6,-.1,1.1]);else p([line(w=>1/Math.hypot(1,w*rc()),0,10,'|H(jΩ)|'),{points:[[1/rc(),1/Math.sqrt(2)]],type:'points',color:'amber',label:'차단점'}],[0,10,0,1.1],'Ω (rad/s)','이득');note.textContent='τ = '+fmt(rc())+' s, Ωc = '+fmt(1/rc())+' rad/s, fc = '+fmt(1/(TAU*rc()))+' Hz. '+(kind==='rc-step'?'한 시정수 뒤 최종값의 약 63.2%에 도달한다.':'차단점의 이득은 1/√2 ≈ 0.707 (−3.01 dB)이다.');};
    } else if(kind==='sampling') {
      const fs=slider('샘플링 주파수 fₛ (Hz)',1.2,8,.1,4),p=one('1 Hz 코사인과 같은 샘플을 만드는 저주파');draw=()=>{const fa=1-Math.round(1/fs())*fs();p([line(t=>Math.cos(TAU*t),0,4,'원 신호 1 Hz'),line(t=>Math.cos(TAU*fa*t),0,4,'기저대역 후보 '+fmt(Math.abs(fa))+' Hz','amber'),{points:seq(0,Math.floor(4*fs()),n=>Math.cos(TAU*n/fs())).map(([n,y])=>[n/fs(),y]),type:'points',color:'red',label:'동일한 샘플'}],[0,4,-1.25,1.25]);note.textContent=fs()>2?'fₛ > 2 Hz: 대역제한 가정 아래 1 Hz 신호를 복원할 수 있다. 두 곡선이 겹친다.':fs()===2?'fₛ = 2 Hz: 경계에서는 위상에 따라 정보가 사라질 수 있다. 엄격한 부등식으로 여유를 둔다.':'fₛ < 2 Hz: 서로 다른 연속 파형이 빨간 샘플을 공유한다. 샘플 이후의 처리만으로 구별할 수 없다.';};
    } else if(kind==='quantization') {
      const bits=slider('비트 수 B',2,8,1,3),p=chart('균일 mid-rise 양자화'),q=chart('오차 e(t) = x(t) − xq(t)');draw=()=>{const d=2/(2**bits()),quant=x=>-1+(Math.min(2**bits()-1,Math.max(0,Math.floor((x+1)/d)))+.5)*d,f=t=>.9*Math.sin(TAU*t);p([line(f,0,2,'원 진폭'),line(t=>quant(f(t)),0,2,'양자화된 진폭','amber')],[0,2,-1.1,1.1]);q([line(t=>f(t)-quant(f(t)),0,2,'오차','red')],[0,2,-d/2,d/2],'t (s)','오차');note.textContent='입력 범위 [−1,1], '+2**bits()+'개 레벨, Δ = '+d.toFixed(5)+', |e| ≤ '+(d/2).toFixed(5)+'. 여기서는 진폭 양자화만 분리해 보여주며 시간 샘플링은 표시하지 않는다.';};
    } else if(kind==='polezero') {
      const p0=slider('극점 p (s⁻¹)',-3,1,.1,-1),p=chart('s 평면의 실수 극점'),q=chart('인과적 h(t) = exp(pt)u(t)');draw=()=>{p([{points:[[p0(),0]],type:'points',color:'red',label:'극점 p'}],[-3.5,1.5,-1,1],'Re(s)','Im(s)');q([line(t=>Math.exp(p0()*t),0,3,'h(t)')],[0,3,0,21]);note.textContent=p0()<0?'p < 0: 감쇠하며 절대적분 가능 → BIBO 안정.':p0()===0?'p = 0: h(t)=u(t). 감쇠도 성장도 없지만 적분기의 계단 출력은 무한히 커져 BIBO 불안정.':'p > 0: 지수 성장 → BIBO 불안정. 이 판단은 인과적 H(s)=1/(s−p)의 예다.';};
    } else if(kind==='dft') {
      const k=slider('신호의 bin 좌표 k₀',1,12,1,4),p=chart('N = 32 시간 샘플'),q=chart('정규화한 양측 DFT');draw=()=>{const N=32,x=seq(0,N-1,n=>Math.cos(TAU*k()*n/N));p([stem(x,'x[n]','blue')],[0,31,-1.25,1.25],'n');q([stem(seq(0,N-1,j=>j===k()||j===N-k()?.5:0),'|X[k]| / N')],[0,31,0,.6],'k (bin)','정규화 크기');note.textContent='k = '+k()+'와 '+(N-k())+'에 각각 0.5. 실수 코사인의 진폭 1은 양·음 주파수 두 성분으로 나뉜다. 원 DFT 값은 각 bin에서 16이다.';};
    } else if(kind==='window') {
      const win=select('창 함수',[['rect','Rectangular'],['hann','Hann'],['hamming','Hamming'],['blackman','Blackman']]),p=chart('길이 64 창 w[n]'),q=chart('7.35-bin 복소지수의 창 적용 스펙트럼');draw=()=>{const N=64,w=Array.from({length:N},(_,n)=>{const a=TAU*n/(N-1);return win()==='hann'?.5-.5*Math.cos(a):win()==='hamming'?.54-.46*Math.cos(a):win()==='blackman'?.42-.5*Math.cos(a)+.08*Math.cos(2*a):1;}),sum=w.reduce((a,b)=>a+b,0);p([stem(w.map((v,n)=>[n,v]),'w[n]','blue')],[0,63,-.1,1.1],'n');q([line(k=>{let re=0,im=0;w.forEach((v,n)=>{const a=TAU*(7.35-k)*n/N;re+=v*Math.cos(a);im+=v*Math.sin(a);});return Math.max(-80,20*Math.log10(Math.max(1e-8,Math.hypot(re,im)/sum)));},0,16,'촘촘히 평가한 DTFT','purple')],[0,16,-80,0],'연속 bin 좌표','크기 (dB, coherent gain 보정)');note.textContent='입력은 exp(j2π·7.35n/64). 각 창의 합으로 정규화해 중심 이득을 0 dB로 맞췄다. 옆 봉우리 억제와 주엽 폭의 교환관계를 비교하자. 곡선은 64개 DFT 점을 단순 연결한 것이 아니다.';};
    } else if(kind==='correlation') {
      const k=slider('이동 k (sample)',-8,8,1,0),p=chart('유한한 두 수열의 정렬'),q=chart('정의한 부호에 따른 상관값');const x=n=>n>=0&&n<=3?1:0,y=n=>x(n-3),corr=k=>{let v=0;for(let n=-20;n<=20;n++)v+=x(n)*y(n-k);return v;};draw=()=>{p([stem(seq(-10,10,x),'x[n]','blue'),stem(seq(-10,10,n=>y(n-k())),'y[n−k]','amber')],[-10,10,-.2,1.2],'n');q([stem(seq(-8,8,corr),'Rxy[k]','purple'),{points:[[k(),corr(k())]],type:'points',color:'red'}],[-8,8,0,4.5],'k');note.textContent='y[n]=x[n−3]은 3샘플 늦다. Rxy[k]=Σx[n]y*[n−k] 규약에서 최대는 k=−3. 현재 Rxy['+k()+']='+corr(k())+'. 지연 부호는 정의에 따라 달라진다.';};
    } else if(kind==='fourier-map') {
      controls.remove();plots.className='ssv-overview';
      const card=(title,desc)=>{const c=document.createElement('article'),h=document.createElement('h5'),p=document.createElement('p');h.textContent=title;p.className='ssv-note';p.textContent=desc;c.append(h,p);plots.append(c);return c;};
      const a=card('연속시간 · 주기 → CTFS','예: xₐ(t)=cos(2πt), Tₚ=1 s. c₋₁=c₁=1/2, 나머지는 0.');
      chart('연속·주기적인 시간 파형',a)([line(t=>Math.cos(TAU*t),-2,2,'xₐ(t)')],[-2,2,-1.2,1.2],'t (s)');
      chart('정수 고조파에서 정의한 계수',a)([stem(seq(-4,4,k=>Math.abs(k)===1?.5:0),'cₖ')],[-4,4,0,.6],'k (F = kF₀)');
      const b=card('이산시간 · 주기 → DTFS','예: x[n]=1 (n이 4의 배수), 그 외 0. cₖ=1/4이며 4주기로 반복.');
      chart('정수 샘플·주기 N=4',b)([stem(seq(-8,8,n=>n%4===0?1:0),'x[n]','blue')],[-8,8,0,1.2],'n');
      chart('계수도 정수 인덱스·N주기',b)([stem(seq(-8,8,()=>.25),'cₖ')],[-8,8,0,.35],'k');
      const c=card('연속시간 · 비주기 → CTFT','예: 폭 1, 높이 1인 원점 중심 펄스. Xₐ(F)=sinc(F), F는 Hz.');
      chart('연속·비주기적인 펄스',c)([{points:[[-2,0],[-.5,0],[-.5,1],[.5,1],[.5,0],[2,0]],label:'xₐ(t)'}],[-2,2,0,1.2],'t (s)');
      chart('연속 주파수의 변환값',c)([line(sinc,-4,4,'Xₐ(F)','amber')],[-4,4,-.3,1.1],'F (Hz)');
      const d=card('이산시간 · 비주기 → DTFT','예: x[n]=0.5^|n|. X(eʲω)=0.75/(1.25−cosω), 2π주기.');
      chart('이산·비주기적인 감쇠 수열',d)([stem(seq(-8,8,n=>.5**Math.abs(n)),'x[n]','blue')],[-8,8,0,1.2],'n');
      chart('연속 주파수·2π주기',d)([line(w=>.75/(1.25-Math.cos(w)),-TAU,TAU,'X(eʲω)','amber')],[-TAU,TAU,0,3.3],'ω (rad/sample)', '변환값',[[-TAU,'−2π'],[-Math.PI,'−π'],[0,'0'],[Math.PI,'π'],[TAU,'2π']]);
      note.textContent='주기신호 → 이산 고조파. 이산시간 신호 → 주파수 표현이 주기적. 이 두 규칙을 독립적으로 적용한다. 계수의 막대는 Dirac 임펄스의 높이가 아니라 계수 값이다.';
    }
    draw();
    if(!controls.children.length)controls.remove();
  });
})();
