/* HTML/Canvas teaching figures. Values are computed from the equations in the posts. */
(() => {
  "use strict";
  const sinc = x => Math.abs(x) < 1e-10 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
  const legendre = (n, x) => {
    if (!n) return 1;
    let a = 1, b = x;
    for (let k = 1; k < n; k++) [a, b] = [b, ((2*k+1)*x*b-k*a)/(k+1)];
    return b;
  };
  // Used only for integer orders 0..4 and 0 <= x <= 12.
  const bessel = (n, x) => {
    let term = 1;
    for (let k = 1; k <= n; k++) term *= x / (2*k);
    let sum = term;
    for (let k = 1; k < 90; k++) {
      term *= -x*x/(4*k*(k+n));
      sum += term;
      if (Math.abs(term) < 1e-16) break;
    }
    return sum;
  };
  const sample = (fn, a, b, n=700) => Array.from({length:n+1}, (_,i) => {
    const x = a+(b-a)*i/n;
    return [x,fn(x)];
  });
  const range = (key, label, min, max, step, value, unit="", digits=0) =>
    ({key,label,min,max,step,value,unit,digits});
  const panel = (title, x, y, xlabel, ylabel, series, square=false) =>
    ({title,x,y,xlabel,ylabel,series,square});
  const curve = (label, points, color=0, dash=false, style="line") =>
    ({label,points,color,dash,style});
  const squareSum = (u, count, cutoff) => {
    let sum=0;
    for (let k=0;k<count;k++) {
      const n=2*k+1, attenuation=cutoff ? 1/Math.sqrt(1+(n/cutoff)**2) : 1;
      sum += 4/(Math.PI*n)*attenuation*Math.sin(2*Math.PI*n*u-(cutoff ? Math.atan(n/cutoff) : 0));
    }
    return sum;
  };
  const configs = {
    square: {
      controls:[range("n","홀수 고조파 개수",1,40,1,5)],
      build: v => ({
        panels:[
          panel("시간 파형 · 진폭 A = 1",[0,2],[-1.35,1.35],"t / T₀","x / A",[
            curve("목표 구형파",[[0,0],[0,1],[.5,1],[.5,-1],[1,-1],[1,1],[1.5,1],[1.5,-1],[2,-1]],2,true),
            curve("유한 부분합",sample(t=>squareSum(t,v.n),0,2,1800))
          ]),
          panel("단측 사인 계수 · 양의 홀수 고조파",[0,2*v.n], [0,1.4],"고조파 번호 n","bₙ / A",[
            curve("4 / (πn)",Array.from({length:v.n},(_,i)=>[2*i+1,4/(Math.PI*(2*i+1))]),0,false,"stem")
          ])
        ],
        text: v.n+"개 항, 최고 "+(2*v.n-1)+"차 고조파. 점프 높이는 2이며 오버슈트의 비율은 항을 늘려도 사라지지 않습니다. 막대는 단측 사인 계수입니다."
      })
    },
    pulse: {
      controls:[range("tau","펄스 폭 τ",.2,1.5,.05,.5," ms",2)],
      build:v=>({
        panels:[
          panel("시간영역 · 단위 진폭 펄스",[-2,2],[-.1,1.2],"t (ms)","x / A",[
            curve("직사각형 펄스",[[-2,0],[-v.tau/2,0],[-v.tau/2,1],[v.tau/2,1],[v.tau/2,0],[2,0]])
          ]),
          panel("주파수영역 · 면적으로 정규화한 부호 있는 스펙트럼",[-8,8],[-.3,1.1],"f (kHz)","X / (Aτ)",[
            curve("sinc(fτ)",sample(f=>sinc(f*v.tau),-8,8),1)
          ])
        ],
        text:"첫 영점: ±"+(1/v.tau).toFixed(2)+" kHz. 첫 영점 사이 주엽 폭: "+(2/v.tau).toFixed(2)+" kHz. 부엽이 계속 이어지므로 엄밀한 유한 대역폭은 아닙니다."
      })
    },
    filter: {
      controls:[range("ratio","차단주파수 / 기본주파수",.2,5,.1,1,"",1)],
      build:v=>({
        panels:[
          panel("정상상태 시간 파형",[0,2],[-1.25,1.25],"t / T₀","전압 / A",[
            curve("입력 · 40개 홀수 항",sample(t=>squareSum(t,40),0,2,1800),2,true),
            curve("RC 출력",sample(t=>squareSum(t,40,v.ratio),0,2,1800))
          ]),
          panel("고조파별 단측 진폭",[0,16],[0,1.35],"고조파 번호 n","진폭 / A",[
            curve("입력",Array.from({length:8},(_,i)=>[2*i+1,4/(Math.PI*(2*i+1))]),2,true,"stem"),
            curve("출력",Array.from({length:8},(_,i)=>{const n=2*i+1;return[n,4/(Math.PI*n*Math.sqrt(1+(n/v.ratio)**2))];}),0,false,"stem")
          ])
        ],
        text:"기본파 이득 "+(1/Math.sqrt(1+1/v.ratio**2)).toFixed(3)+", 위상 "+(-Math.atan(1/v.ratio)*180/Math.PI).toFixed(1)+"°. 초기 과도응답을 제외하고 40개의 홀수 고조파를 합친 정상상태 근사입니다."
      })
    },
    alias: {
      controls:[range("f","입력 코사인 주파수",100,1400,25,900," Hz")],
      build:v=>{
        const fa=Math.abs(v.f-Math.round(v.f/1000)*1000);
        return {
          panels:[panel("샘플링 주파수 1,000 Hz · 같은 샘플을 지나는 두 파형",[0,8],[-1.2,1.2],"t (ms)","진폭",[
            curve("원래 신호",sample(t=>Math.cos(2*Math.PI*v.f*t/1000),0,8),0),
            curve("0~500 Hz의 동일 샘플 코사인",sample(t=>Math.cos(2*Math.PI*fa*t/1000),0,8),1,true),
            curve("샘플",Array.from({length:9},(_,n)=>[n,Math.cos(2*Math.PI*v.f*n/1000)]),3,false,"dots")
          ])],
          text:"샘플만 보면 "+v.f+" Hz와 "+fa+" Hz의 코사인을 구분할 수 없습니다. 점은 1 ms 간격입니다. 이 예제는 위상이 0인 코사인 기준입니다."
        };
      }
    },
    leakage: {
      controls:[range("offset","8번 bin으로부터 주파수 차이",0,.5,.01,.3," bin",2),
        {key:"window",label:"관측창",value:"rect",options:[["rect","사각창"],["hann","주기형 Hann 창"]]}],
      build:v=>{
        const N=64, w=Array.from({length:N},(_,n)=>v.window==="hann" ? .5-.5*Math.cos(2*Math.PI*n/N) : 1);
        const sum=w.reduce((a,b)=>a+b,0);
        const magnitude=k=>{
          let re=0,im=0;
          for(let n=0;n<N;n++){const angle=2*Math.PI*(8+v.offset-k)*n/N;re+=w[n]*Math.cos(angle);im+=w[n]*Math.sin(angle);}
          return Math.hypot(re,im)/sum;
        };
        return {
          panels:[panel("64개 복소지수 샘플 · 창 이득을 보정한 크기",[3,14],[0,1.1],"주파수 / bin 간격","정규화 크기",[
            curve("창 적용 후 연속 주파수 평가",sample(magnitude,3,14,700),1),
            curve("DFT가 읽는 정수 bin",Array.from({length:12},(_,i)=>[i+3,magnitude(i+3)]),0,false,"stem")
          ])],
          text:"입력 주파수: "+(8+v.offset).toFixed(2)+" bin. 복소지수 하나를 사용해 음의 주파수 성분과의 혼동을 피했습니다. 곡선은 같은 유한 데이터의 연속 주파수 평가이며, 새 관측 데이터가 아닙니다."
        };
      }
    },
    modulation: {
      controls:[range("fc","반송파 주파수",4,12,.5,8," kHz",1)],
      build:v=>({
        panels:[
          panel("메시지 1 kHz · DSB-SC 시간 신호",[0,2],[-1.2,1.2],"t (ms)","진폭",[
            curve("메시지 m(t)",sample(t=>Math.cos(2*Math.PI*t),0,2),2,true),
            curve("m(t) cos(2πfct)",sample(t=>Math.cos(2*Math.PI*t)*Math.cos(2*Math.PI*v.fc*t),0,2,1200))
          ]),
          panel("양측 스펙트럼 · 델타의 가중치",[-14,14],[0,.6],"f (kHz)","선 가중치",[
            curve("메시지 · 각 1/2",[[-1,.5],[1,.5]],2,true,"stem"),
            curve("변조 후 · 각 1/4",[[-v.fc-1,.25],[-v.fc+1,.25],[v.fc-1,.25],[v.fc+1,.25]],0,false,"stem")
          ])
        ],
        text:"양의 측파대는 "+(v.fc-1).toFixed(1)+" kHz와 "+(v.fc+1).toFixed(1)+" kHz입니다. 각 실수 측파대 코사인의 진폭은 1/2, 양측 복소 스펙트럼의 가중치는 각각 1/4입니다."
      })
    },
    iq: {
      controls:[range("i","동상 성분 I",-2,2,.1,1,"",1),range("q","직교 성분 Q",-2,2,.1,1,"",1)],
      build:v=>({
        panels:[
          panel("복소 포락선 · I/Q 평면",[-2.5,2.5],[-2.5,2.5],"I","Q",[
            curve("I + jQ",[[0,0],[v.i,v.q]],0),
            curve("선택한 심볼",[[v.i,v.q]],0,false,"dots")
          ],true),
          panel("한 반송파 주기 · I cos − Q sin",[0,1],[-3,3],"t / Tc","실수 RF 신호",[
            curve("I cos",sample(t=>v.i*Math.cos(2*Math.PI*t),0,1),2,true),
            curve("−Q sin",sample(t=>-v.q*Math.sin(2*Math.PI*t),0,1),1,true),
            curve("합",sample(t=>v.i*Math.cos(2*Math.PI*t)-v.q*Math.sin(2*Math.PI*t),0,1))
          ])
        ],
        text:"진폭 "+Math.hypot(v.i,v.q).toFixed(3)+(v.i===0&&v.q===0 ? ", 영벡터의 위상은 정의되지 않습니다." : ", 위상 "+(Math.atan2(v.q,v.i)*180/Math.PI).toFixed(1)+"°.")+" 시간축은 반송파 한 주기로 정규화했습니다."
      })
    },
    ofdm: {
      controls:[range("eps","정규화 주파수 오차 ε",-.5,.5,.01,0,"",2)],
      build:v=>({
        panels:[
          panel("세 부반송파의 크기 스펙트럼 · 유효 심볼 시간 Tu",[-2,4],[0,1.12],"f · Tu","정규화 크기",[0,1,2].map(k=>
            curve("송신 "+k+"번",sample(f=>Math.abs(sinc(f-k-v.eps)),-2,4),k))
          ),
          panel("0번만 송신했을 때 각 수신 bin에 남는 전력",[-4.5,4.5],[0,1.05],"수신 bin m","sinc²(ε − m)",[
            curve("수신 투영 전력",Array.from({length:9},(_,i)=>[i-4,sinc(v.eps-(i-4))**2]),0,false,"stem")
          ])
        ],
        text:"0번 bin에 남는 전력 비율: "+(100*sinc(v.eps)**2).toFixed(2)+"%. ε = 0이면 다른 정수 bin의 기여는 0입니다. 아래 그래프는 단일 송신 부반송파의 누설이며 잡음·다중경로를 제외했습니다."
      })
    },
    heat: {
      controls:[range("time","무차원 시간 θ = Dπ²t/L²",0,2,.02,0,"",2)],
      build:v=>({
        panels:[panel("고정 온도 경계 · 두 공간 모드의 합",[0,1],[-.15,1.6],"x / L","온도편차 (정규화)",[
          curve("초기 분포",sample(x=>Math.sin(Math.PI*x)+.5*Math.sin(3*Math.PI*x),0,1),2,true),
          curve("현재 분포",sample(x=>Math.exp(-v.time)*Math.sin(Math.PI*x)+.5*Math.exp(-9*v.time)*Math.sin(3*Math.PI*x),0,1)),
          curve("3번 모드만",sample(x=>.5*Math.exp(-9*v.time)*Math.sin(3*Math.PI*x),0,1),1,true)
        ])],
        text:"1번 모드 진폭 "+Math.exp(-v.time).toFixed(3)+", 3번 모드 진폭 "+(.5*Math.exp(-9*v.time)).toFixed(3)+". 실제 시간은 t = θL²/(Dπ²)입니다."
      })
    },
    smith: {
      controls:[range("r","정규화 저항 r",0,5,.1,2,"",1),range("x","정규화 리액턴스 x",-5,5,.1,1,"",1)],
      build:v=>{
        const d=(v.r+1)**2+v.x**2;
        const re=(v.r*v.r+v.x*v.x-1)/d, im=2*v.x/d, mag=Math.hypot(re,im);
        const pts=(r,x)=>{const q=(r+1)**2+x*x;return[(r*r+x*x-1)/q,2*x/q];};
        const series=[
          curve("수동 부하의 경계",sample(t=>t,0,1).map((_,i)=>[Math.cos(2*Math.PI*i/700),Math.sin(2*Math.PI*i/700)]),2,true)
        ];
        for(const r of [.2,.5,1,2,5]) series.push(curve("",sample(t=>t,-25,25,400).map(([x])=>pts(r,x)),2,true));
        for(const x of [-2,-1,-.5,.5,1,2]) series.push(curve("",sample(t=>t,0,25,400).map(([r])=>pts(r,x)),2,true));
        series.push(curve("Γ",[[0,0],[re,im]],0),curve("선택한 부하",[[re,im]],0,false,"dots"));
        return {
          panels:[panel("반사계수 평면 · 실수 양의 Z₀ 기준",[-1.15,1.15],[-1.15,1.15],"Re Γ","Im Γ",series,true)],
          text:"Γ = "+re.toFixed(3)+(im<0?" − ":" + ")+Math.abs(im).toFixed(3)+"j, 크기 "+mag.toFixed(3)+". 반사 전력 "+(100*mag*mag).toFixed(1)+"%, VSWR "+(mag>=1-1e-10?"∞":((1+mag)/(1-mag)).toFixed(3))+"."
        };
      }
    },
    legendre: {
      controls:[range("degree","강조할 차수 ℓ",0,4,1,2)],
      build:v=>({
        panels:[panel("르장드르 다항식 · Pℓ(1) = 1",[-1,1],[-1.1,1.1],"x","Pℓ(x)",
          Array.from({length:5},(_,n)=>curve("P"+n,sample(x=>legendre(n,x),-1,1),n,n!==v.degree)))],
        text:"선택 차수 ℓ = "+v.degree+". 선택 곡선은 실선, 나머지는 점선입니다. 짝수 차수는 짝함수, 홀수 차수는 홀함수입니다."
      })
    },
    bessel: {
      controls:[range("order","추가로 비교할 차수 m",2,4,1,2)],
      build:v=>({
        panels:[panel("제1종 베셀 함수 · 원점에서 유한한 가지",[0,12],[-.5,1.1],"x","Jm(x)",[0,1,v.order].map((n,i)=>
          curve("J"+n,sample(x=>bessel(n,x),0,12),i)))],
        text:"J₀(0) = 1, 양의 정수 m에서 Jm(0) = 0입니다. 원통 기하에 따른 공간 분포이며, 진폭 감소 자체가 재료 손실을 뜻하지 않습니다."
      })
    },
    tm01: {
      controls:[range("radius","관찰 반지름 r/a",0,1,.01,.5,"",2)],
      build:v=>({
        panels:[
          {title:"TM₀₁ 단면 · 정규화 축방향 전기장 진폭",disk:true,radius:v.radius,square:true},
          panel("중심에서 금속 벽까지",[0,1],[-.05,1.1],"r / a","Ez / Ez(0)",[
            curve("J₀(2.40482556 r/a)",sample(r=>bessel(0,2.4048255577*r),0,1)),
            curve("관찰 위치",[[v.radius,bessel(0,2.4048255577*v.radius)]],1,false,"dots")
          ])
        ],
        text:"r/a = "+v.radius.toFixed(2)+"에서 정규화 축방향 진폭은 "+bessel(0,2.4048255577*v.radius).toFixed(3)+". 단면 색상은 진폭이며 전력밀도나 전체 벡터장은 아닙니다."
      })
    }
  };
  let sequence=0;
  document.querySelectorAll("[data-ee-visual]").forEach(root=>{
    if(root.dataset.eeReady) return;
    const config=configs[root.dataset.eeVisual];
    if(!config) return;
    root.dataset.eeReady="true";
    const values={}, outputs=new Map(), controls=root.querySelector(".ee-visual-controls");
    const id="ee-visual-"+(++sequence);
    config.controls.forEach(c=>{
      values[c.key]=c.value;
      const label=document.createElement("label");
      const row=document.createElement("span");row.className="ee-visual-control-caption";
      const name=document.createElement("span");name.textContent=c.label;row.append(name);
      const input=document.createElement(c.options?"select":"input");
      input.id=id+"-"+c.key; label.htmlFor=input.id;
      if(c.options) c.options.forEach(([value,text])=>{const option=document.createElement("option");option.value=value;option.textContent=text;input.append(option);});
      else {input.type="range";input.min=c.min;input.max=c.max;input.step=c.step;}
      input.value=c.value;
      const output=document.createElement("output");output.htmlFor=input.id;row.append(output);
      outputs.set(c.key,output);
      label.append(row,input);controls.append(label);
      input.addEventListener("input",()=>{
        values[c.key]=c.options?input.value:Number(input.value);render();
      });
    });
    const host=root.querySelector(".ee-visual-panels");
    const readout=root.querySelector(".ee-visual-readout");
    let figures=[], drawRequest=0;
    const color=()=> {
      const fg=getComputedStyle(root).color;
      const dark=document.documentElement.dataset.theme==="dark";
      return {fg,palette:dark?["#6db7ff","#ffbd69","#a8b3c3","#dc99f8","#78d5ba"]:["#1268b5","#aa5200","#66717e","#8b399f","#08785c"]};
    };
    function draw(canvas,spec) {
      const width=canvas.clientWidth,height=canvas.clientHeight,dpr=window.devicePixelRatio||1;
      if(width<1||height<1)return;
      const dw=Math.round(width*dpr),dh=Math.round(height*dpr);
      if(canvas.width!==dw)canvas.width=dw;
      if(canvas.height!==dh)canvas.height=dh;
      const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
      ctx.clearRect(0,0,width,height);
      const {fg,palette}=color();
      ctx.font="12px sans-serif";ctx.lineWidth=1;
      if(spec.disk) {
        const cx=width/2,cy=height/2-4,r=Math.max(20,Math.min(width,height)/2-40);
        for(let k=200;k>=1;k--) {
          const rr=k/200, amp=Math.max(0,bessel(0,2.4048255577*rr));
          ctx.fillStyle="hsl("+(220-25*amp)+" 75% "+(18+57*amp)+"%)";
          ctx.beginPath();ctx.arc(cx,cy,r*rr,0,2*Math.PI);ctx.fill();
        }
        ctx.strokeStyle=palette[1];ctx.setLineDash([4,4]);
        ctx.beginPath();ctx.arc(cx,cy,r*spec.radius,0,2*Math.PI);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle=fg;ctx.textAlign="center";
        ctx.fillText("중심 1 → 벽 0",cx,height-10);
        ctx.fillText("r = a",cx,cy-r-10);
        ctx.fillStyle="#101a26";ctx.fillText("1",cx,cy+4);return;
      }
      const left=44,right=14,top=25,bottom=42;
      let pw=width-left-right,ph=height-top-bottom,ox=left,oy=top;
      if(spec.square){const side=Math.min(pw,ph);ox+=(pw-side)/2;oy+=(ph-side)/2;pw=ph=side;}
      const X=x=>ox+(x-spec.x[0])/(spec.x[1]-spec.x[0])*pw;
      const Y=y=>oy+ph-(y-spec.y[0])/(spec.y[1]-spec.y[0])*ph;
      const tick=x=>Math.abs(x)<1e-8?"0":Number(x.toPrecision(3)).toString();
      for(let i=0;i<=4;i++){
        const x=spec.x[0]+(spec.x[1]-spec.x[0])*i/4;
        const y=spec.y[0]+(spec.y[1]-spec.y[0])*i/4;
        ctx.strokeStyle=fg;ctx.globalAlpha=.15;ctx.beginPath();ctx.moveTo(X(x),oy);ctx.lineTo(X(x),oy+ph);ctx.moveTo(ox,Y(y));ctx.lineTo(ox+pw,Y(y));ctx.stroke();ctx.globalAlpha=1;
        ctx.fillStyle=fg;ctx.textAlign="center";ctx.fillText(tick(x),X(x),oy+ph+17);
        ctx.textAlign="right";ctx.fillText(tick(y),ox-5,Y(y)+4);
      }
      ctx.globalAlpha=.45;ctx.strokeStyle=fg;ctx.beginPath();
      if(spec.y[0]<=0&&spec.y[1]>=0){ctx.moveTo(ox,Y(0));ctx.lineTo(ox+pw,Y(0));}
      if(spec.x[0]<=0&&spec.x[1]>=0){ctx.moveTo(X(0),oy);ctx.lineTo(X(0),oy+ph);}
      ctx.stroke();ctx.globalAlpha=1;ctx.fillStyle=fg;
      ctx.textAlign="left";ctx.fillText(spec.ylabel,ox,12);
      ctx.textAlign="center";ctx.fillText(spec.xlabel,ox+pw/2,height-4);
      ctx.save();ctx.beginPath();ctx.rect(ox,oy,pw,ph);ctx.clip();
      for(const s of spec.series) {
        ctx.strokeStyle=ctx.fillStyle=palette[s.color%palette.length];ctx.lineWidth=s.dash?1.25:2;
        ctx.setLineDash(s.dash?[5,4]:[]);
        if(s.style==="dots"||s.style==="stem"){
          for(const [x,y] of s.points){
            if(s.style==="stem"){ctx.beginPath();ctx.moveTo(X(x),Y(0));ctx.lineTo(X(x),Y(y));ctx.stroke();}
            ctx.beginPath();ctx.arc(X(x),Y(y),3.4,0,Math.PI*2);ctx.fill();
          }
        } else {
          ctx.beginPath();let started=false;
          for(const [x,y] of s.points){if(!Number.isFinite(y)){started=false;continue;}if(!started){ctx.moveTo(X(x),Y(y));started=true;}else ctx.lineTo(X(x),Y(y));}
          ctx.stroke();
        }
      }
      ctx.restore();ctx.setLineDash([]);
    }
    function render() {
      const model=config.build(values);
      config.controls.forEach(c=>{
        outputs.get(c.key).textContent=c.options?"":Number(values[c.key]).toFixed(c.digits)+(c.unit||"");
      });
      readout.textContent=model.text;
      if(!figures.length) {
        model.panels.forEach(spec=>{
          const figure=document.createElement("figure");figure.className="ee-visual-panel";
          if(spec.square)figure.dataset.square="true";
          const caption=document.createElement("figcaption"),canvas=document.createElement("canvas"),legend=document.createElement("div");
          canvas.setAttribute("role","img");canvas.textContent=spec.title+" — 수식과 해설은 본문을 참고하세요.";
          legend.className="ee-visual-legend";figure.append(caption,canvas,legend);host.append(figure);
          figures.push({caption,canvas,legend});
        });
      }
      model.panels.forEach((spec,i)=>{
        const f=figures[i];f.caption.textContent=spec.title;f.canvas.setAttribute("aria-label",spec.title+". "+model.text);
        f.legend.replaceChildren();
        (spec.series||[]).filter(s=>s.label).forEach(s=>{
          const tag=document.createElement("span");tag.textContent=s.label;tag.style.setProperty("--line-color",color().palette[s.color%5]);f.legend.append(tag);
        });
        draw(f.canvas,spec);
      });
    }
    function queueDraw(){cancelAnimationFrame(drawRequest);drawRequest=requestAnimationFrame(render);}
    render();
    const observer=new ResizeObserver(queueDraw);
    figures.forEach(f=>observer.observe(f.canvas));
    new MutationObserver(queueDraw).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    window.addEventListener("resize",queueDraw);
  });
})();
