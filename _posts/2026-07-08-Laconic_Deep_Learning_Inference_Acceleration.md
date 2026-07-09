---
layout: single
title: "Laconic Deep Learning Inference Acceleration, ISCA 2019"
categories: Paper_review
tags: PR
toc: true
author_profile: false
---


# ◼︎ Abstract

곱 연산을 bit 수준에서 분해하는 하드웨어 가속기 Laconic을 통해 곱셈에 필요한 연산량을 40배 가까이 줄이는 결과를 얻음.

# ◼︎ Introduction

하드웨어 가속이 필요로 하는데 이 부분은 보통 MAC 연산과 이와 관련된 data 전송에서 bottleneck이 있음. 그래서 보통 4가지로 이를 해결함.

- **1. Data reuse:** 데이터 흐름을 효율적으로 scheduling하는 방식
- **2. Data type and width:** Quantization(16, 8 등등 비트수 낮추기)
- **3. Zero values(Sparsity):** 0 값을 처리하는 방식(pruning)
- **4. Approximate computation:** 정확하지 않고 근사치로

## Our Focus

Bit Sparsity: 보통은 0값을 skip하려고 했다면 이 연구에서는 어떠한 값 내부의 비트에 0이 있는 경우의 연산을 skip하는 것을 목표로 함. 그래도 수학적으로는 같기 때문임.

### Contrtibution

1. 기존에 16bit 모델에서 0bit의 비율이 90% 이상이라는 것을 넘어 8bit, pruning 된 모델 등등 quantized 모델도 그러함을 증명
2. Laconic 설계. 입력 데이터를 리스트로 encoding 하고 직렬로 곱하고 accumulate함. 병렬성 때문에 전체적인 latency 감소. 이를 LPE(Laconic Processing element)유닛으로 하여 면적이 크고 전력을 많이 먹는 곱셈기 대신 작은 adder를 많이 사용하여 조합한 방식으로 효율적인 설계. 

# ◼︎ Bit Sparsity Is Abundant

Quantize, dense, prune 모델 등 bit level에서도 sparse함. 

$$o(n, y, x) = \sum_{k=0}^{C-1} \sum_{j=0}^{H_F-1} \sum_{i=0}^{W_F-1} w^n(k, j, i) \times a(k, j + y \times S, i + x \times S)$$

- $a$: Activation channel로 $C \times H \times W$ (Channel, height, width) 
- $S$: Stride
- $fmaps$: $C \times H_F \times W_F$ 가 K개
- $omap$: $K \times H_O \times W_O$

(논문에서 S=1만 나와있지만 달라져도 다 가능)

<style>
  .conv2d-container { display: flex; align-items: center; justify-content: center; gap: 20px; font-family: 'Consolas', monospace; margin: 30px 0; overflow-x: auto; color: #eaeaea; }
  .col-group { display: flex; flex-direction: column; gap: 20px; align-items: center; }
  .label { font-size: 13px; color: #aaa; text-align: center; margin-bottom: 5px; font-family: 'Pretendard', sans-serif; }
  
  .matrix { display: grid; border: 2px solid #555; background: #1e1e1e; padding: 3px; border-radius: 4px; box-shadow: 2px 2px 8px rgba(0,0,0,0.3); }
  .cell { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid #444; font-size: 14px; transition: 0.1s; background: #252a34; }
  
  .grid-4x4 { grid-template-columns: repeat(4, 1fr); }
  .grid-3x3 { grid-template-columns: repeat(3, 1fr); }
  .grid-2x2 { grid-template-columns: repeat(2, 1fr); }

  /* 채널별 색상 하이라이트 */
  .hl-ch0 { background: rgba(0, 173, 181, 0.3) !important; border-color: #00adb5 !important; color: #00adb5; font-weight: bold; }
  .hl-ch1 { background: rgba(76, 175, 80, 0.3) !important; border-color: #4caf50 !important; color: #4caf50; font-weight: bold; }
  .hl-out { background: rgba(255, 87, 34, 0.8) !important; border-color: #ff5722 !important; color: #fff; font-weight: bold; cursor: pointer; transform: scale(1.1); z-index: 10; position: relative; }

  .operator { font-size: 24px; font-weight: bold; color: #888; }
  
  /* 계산 결과창 디자인 */
  .math-box { text-align: left; background: #1a1d24; padding: 15px 20px; border-radius: 8px; border: 1px solid #444; font-size: 14px; font-family: 'Consolas', monospace; line-height: 1.8; margin-top: 10px; overflow-x: auto; min-height: 100px; }
  .badge { padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #fff; font-size: 12px; margin-right: 8px; }
  .badge-ch0 { background: #00adb5; }
  .badge-ch1 { background: #4caf50; }
</style>

<div class="conv2d-container">
  <div class="col-group">
    <div>
      <div class="label">Activation (Ch 0)</div>
      <div class="matrix grid-4x4" id="act-ch0">
        <div class="cell">1</div><div class="cell">2</div><div class="cell">3</div><div class="cell">0</div>
        <div class="cell">0</div><div class="cell">1</div><div class="cell">2</div><div class="cell">3</div>
        <div class="cell">3</div><div class="cell">0</div><div class="cell">1</div><div class="cell">2</div>
        <div class="cell">2</div><div class="cell">3</div><div class="cell">0</div><div class="cell">1</div>
      </div>
    </div>
    <div>
      <div class="label">Activation (Ch 1)</div>
      <div class="matrix grid-4x4" id="act-ch1">
        <div class="cell">0</div><div class="cell">1</div><div class="cell">1</div><div class="cell">2</div>
        <div class="cell">2</div><div class="cell">0</div><div class="cell">0</div><div class="cell">1</div>
        <div class="cell">1</div><div class="cell">2</div><div class="cell">3</div><div class="cell">0</div>
        <div class="cell">0</div><div class="cell">1</div><div class="cell">1</div><div class="cell">2</div>
      </div>
    </div>
  </div>

  <div class="operator">⊗</div>

  <div class="col-group">
    <div>
      <div class="label">Weight (Ch 0)</div>
      <div class="matrix grid-3x3" id="wei-ch0">
        <div class="cell" style="color:#00adb5;">2</div><div class="cell" style="color:#00adb5;">0</div><div class="cell" style="color:#00adb5;">1</div>
        <div class="cell" style="color:#00adb5;">0</div><div class="cell" style="color:#00adb5;">1</div><div class="cell" style="color:#00adb5;">2</div>
        <div class="cell" style="color:#00adb5;">1</div><div class="cell" style="color:#00adb5;">0</div><div class="cell" style="color:#00adb5;">2</div>
      </div>
    </div>
    <div>
      <div class="label">Weight (Ch 1)</div>
      <div class="matrix grid-3x3" id="wei-ch1">
        <div class="cell" style="color:#4caf50;">1</div><div class="cell" style="color:#4caf50;">0</div><div class="cell" style="color:#4caf50;">1</div>
        <div class="cell" style="color:#4caf50;">0</div><div class="cell" style="color:#4caf50;">1</div><div class="cell" style="color:#4caf50;">0</div>
        <div class="cell" style="color:#4caf50;">1</div><div class="cell" style="color:#4caf50;">0</div><div class="cell" style="color:#4caf50;">1</div>
      </div>
    </div>
  </div>

  <div class="operator">=</div>

  <div class="col-group">
    <div>
      <div class="label">Bias</div>
      <div class="matrix grid-1x1" style="margin-bottom: 50px;">
        <div class="cell" style="color:#ffb74d;">3</div>
      </div>
    </div>
    <div>
      <div class="label">Output (Result)</div>
      <div class="matrix grid-2x2" id="res-map">
        <div class="cell" onmouseover="calcMAC(0,0,23)" onmouseout="clearMAC()">23</div>
        <div class="cell" onmouseover="calcMAC(0,1,24)" onmouseout="clearMAC()">24</div>
        <div class="cell" onmouseover="calcMAC(1,0,14)" onmouseout="clearMAC()">14</div>
        <div class="cell" onmouseover="calcMAC(1,1,25)" onmouseout="clearMAC()">25</div>
      </div>
    </div>
  </div>
</div>

<div class="math-box" id="math-display">
  <div style="text-align:center; color:#888; margin-top:25px;">출력 결과(Output) 행렬의 숫자에 마우스를 올려보세요!</div>
</div>

<script>
  const a_ch0 = document.querySelectorAll('#act-ch0 .cell');
  const a_ch1 = document.querySelectorAll('#act-ch1 .cell');
  const w_ch0 = document.querySelectorAll('#wei-ch0 .cell');
  const w_ch1 = document.querySelectorAll('#wei-ch1 .cell');
  const res = document.querySelectorAll('#res-map .cell');
  
  // Weight 배열 데이터
  const w0_arr = [2,0,1, 0,1,2, 1,0,2];
  const w1_arr = [1,0,1, 0,1,0, 1,0,1];
  const bias = 3;

  function calcMAC(y, x, final_result) {
    const outIdx = y * 2 + x;
    res[outIdx].classList.add('hl-out');

    let sum0 = 0, sum1 = 0;
    let eq0 = "", eq1 = "";
    let fIdx = 0;

    for(let j = 0; j < 3; j++) {
      for(let i = 0; i < 3; i++) {
        // Stride = 1 위치 계산
        const inIdx = (y + j) * 4 + (x + i);
        
        // Channel 0 연산
        a_ch0[inIdx].classList.add('hl-ch0');
        w_ch0[fIdx].classList.add('hl-ch0');
        const v0 = parseInt(a_ch0[inIdx].innerText);
        const w0 = w0_arr[fIdx];
        sum0 += v0 * w0;
        eq0 += `<span style="color:#aaa">(${v0}×${w0})</span>`;
        if (fIdx < 8) eq0 += " + ";

        // Channel 1 연산
        a_ch1[inIdx].classList.add('hl-ch1');
        w_ch1[fIdx].classList.add('hl-ch1');
        const v1 = parseInt(a_ch1[inIdx].innerText);
        const w1 = w1_arr[fIdx];
        sum1 += v1 * w1;
        eq1 += `<span style="color:#aaa">(${v1}×${w1})</span>`;
        if (fIdx < 8) eq1 += " + ";

        fIdx++;
      }
    }

    document.getElementById('math-display').innerHTML = 
      `<div><span class="badge badge-ch0">Ch 0</span> ${eq0} = <strong style="color:#00adb5; font-size:16px;">${sum0}</strong></div>` +
      `<div style="margin: 10px 0;"><span class="badge badge-ch1">Ch 1</span> ${eq1} = <strong style="color:#4caf50; font-size:16px;">${sum1}</strong></div>` +
      `<div style="border-top: 1px dashed #555; padding-top: 10px; margin-top: 5px;">` +
      `<strong>Final Result</strong> = <span style="color:#00adb5">${sum0}</span> + <span style="color:#4caf50">${sum1}</span> + <span style="color:#ffb74d">Bias(${bias})</span> = <strong style="color:#ff5722; font-size:20px;">${final_result}</strong>` +
      `</div>`;
  }

  function clearMAC() {
    a_ch0.forEach(c => c.classList.remove('hl-ch0'));
    a_ch1.forEach(c => c.classList.remove('hl-ch1'));
    w_ch0.forEach(c => c.classList.remove('hl-ch0'));
    w_ch1.forEach(c => c.classList.remove('hl-ch1'));
    res.forEach(c => c.classList.remove('hl-out'));
    document.getElementById('math-display').innerHTML = 
      `<div style="text-align:center; color:#888; margin-top:25px;">출력 결과(Output) 행렬의 숫자에 마우스를 올려보세요!</div>`;
  }
</script>

결론적으로는 이렇게 많은 부분에서 bit level sparsity가 발생함.

<center><img src="/images/PR/Laconic/figure1.JPG" width = "700"><br></center>

여기에서 A는 zero activation 즉 activation 값이 0일 때만 skip하는것, W는 Weight 값이 0일 때만 skip하는 것, At는 activation 값의 bit level에서 0을 skip하는 것, Wt는 weight 값이 bit level에서 0을 skip하는 것이다. 그래서 이 Laconic에서는 At+Wt 모두 적용해서 speed up이 어떤 모델에서든 크게 향상된 것을 보임. 

우선 기본적인 bit level에서의 곱을 예시 값 **활성화(A) = 15 (`0000 1111`)**와 **가중치(W) = 7 (`0000 0111`)**의 곱셈 연산($15 \times 7 = 105$)으로 보면 다음과 같음

## 1. 일반적인 시프트 후 덧셈 방식 (Conventional Shift-and-Add)
가장 고전적인 직렬/순차적 곱셈 방식으로, 하위 비트부터 상위 비트까지 순회하며 비트가 `1`일 때마다 피승수(A)를 자릿수만큼 왼쪽으로 밀어(Shift) 가산기 트리로 누적함.

```text
          0 0 0 0 1 1 1 1  (A = 15)
   ×      0 0 0 0 0 1 1 1  (W = 7)
  ────────────────────────
          0 0 0 0 1 1 1 1  <── W의 0번째 비트(1) × A  =  15
        0 0 0 1 1 1 1 0    <── W의 1번째 비트(1) × A  =  30  (왼쪽으로 1칸 시프트)
  +   0 0 1 1 1 1 0 0      <── W의 2번째 비트(1) × A  =  60  (왼쪽으로 2칸 시프트)
  ────────────────────────
      0 1 1 0 1 0 0 1      <── 이진수 최종 합산 결과  = 105
```

## 2. 일반적인 비트 병렬 어레이 방식 (Conventional Bit-Parallel Array)
하드웨어에서는 자리수만 알아도 계산이 가능함. 우선 $A \times W = \sum_{i=0}^{7} \sum_{j=0}^{7} A_i \text{ AND } W_j$ 이런 형태로 계산이 됨.

```text
        W 비트열 (j)  -->   0   0   0   0   0   1   1   1  (값: 7)
   A 비트열 (i)
      |
      ▼
    7 (0)                 0   0   0   0   0   0   0   0
    6 (0)                 0   0   0   0   0   0   0   0
    5 (0)                 0   0   0   0   0   0   0   0
    4 (0)                 0   0   0   0   0   0   0   0
    3 (1)                 0   0   0   0   0   1   1   1 
    2 (1)                 0   0   0   0   0   1   1   1
    1 (1)                 0   0   0   0   0   1   1   1
    0 (1)                 0   0   0   0   0   1   1   1
  (값: 15)
  ```

이렇게 되면 12개의 1값만 필요하게 됨. 왜냐하면 

```text
A 비트 위치 (i)     ──>        j=2 (4의자리)     j=1 (2의자리)     j=0 (1의자리)
      │
      ▼
     i=3 (8의 자리)             32              16              8    
     i=2 (4의 자리)             16               8              4   
     i=1 (2의 자리)              8               4              2    
     i=0 (1의 자리)              4               2              1   
```

- $i=0$ 행 (1의 자리 비트가 만든 값들): $$2^2 + 2^1 + 2^0 = 4 + 2 + 1 = \mathbf{7}$$
- $i=1$ 행 (2의 자리 비트가 만든 값들): $$2^3 + 2^2 + 2^1 = 8 + 4 + 2 = \mathbf{14}$$
- $i=2$ 행 (4의 자리 비트가 만든 값들): $$2^4 + 2^3 + 2^2 = 16 + 8 + 4 = \mathbf{28}$$
- $i=3$ 행 (8의 자리 비트가 만든 값들): $$2^5 + 2^4 + 2^3 = 32 + 16 + 8 = \mathbf{56}$$

이제 하드웨어가 최종 출력 레이어에서 이 행들의 결과를 모두 합하면 $$\text{최종 연산 결과} = 7 + 14 + 28 + 56 = \mathbf{105}$$. 즉 $2^{i+j}$만 있으면 연산을 할 수 있다. 그래도 어쨌든 $8 \times 8 = 64$번의 연산이 필요함. 0부분을 skip한다고 하더라도 이 경우에는 12번 즉, 1이 공통적으로 나오는 부분의 bit 수 만큼은 필요하다는 것임.
