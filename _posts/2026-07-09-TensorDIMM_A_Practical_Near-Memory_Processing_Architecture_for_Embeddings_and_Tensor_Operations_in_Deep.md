---
layout: single
title: "TensorDIMM_A Practical Near-Memory Processing Architecture for Embeddings and Tensor Operations in Deep, MICRO 2019"
categories: Paper_review
tags: PR
toc: true
author_profile: false
comments: true
---


# ◼︎ Abstract

Tensor 연산의 memory 용량과 bandwidth 문제를 해결 하기 위해 Near Memory Processing(NMP)코어를 가진 DIMM모듈을 이용함.

# ◼︎ Introduction

CNN과 달리 DNN에서는 GPU나 NPU로 가속을 해결하는 부분 보다 memory wall문제가 매우 큼. Convolution 연산보다 embedding layer의 높은 memory capacity와 bandwidth를 GPU의 memory가 커버를 하지 못하고 이 부분의 workload가 매우 높음. 그래서 DNN inference에 CPU만 사용하거나 embedding만 CPU에서 하고 나머지는 GPU에서 하는 hybrid CPU-GPU를 사용함. 근데 이는 모든 embedding이 GPU memory에 저장될 수 있다고 가정하면 엄청 속도차이가 남. CPU만 사용하면 data 가져오면서 overhead가 있고 CPU-GPU를 해도 PCle channel을 통해 embedding을 복사하는 과정 때문에 latency가 생김. 

그래서 DIMM에 기반하되 Near Memory Processing(NMP) unit을 추가하여 개선한 TensorDIMM을 제시함. 상용 DRAM 장치를 그대로 활용하면서 GPU와 호환되게하는 TensorDIMM이 embedding을 훨씬 빠르게 하여 속도 향상을 시킴.

# ◼︎ Background

# ◼︎ Bit Sparsity Is Abundant

Quantize, dense, prune 모델 등 bit level에서도 sparse함. 

$o(n, y, x) = \sum_{k=0}^{C-1} \sum_{j=0}^{H_F-1} \sum_{i=0}^{W_F-1} w^n(k, j, i) \times a(k, j + y \times S, i + x \times S)$

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

- $i=0$ 행 (1의 자리 비트가 만든 값들): $2^2 + 2^1 + 2^0 = 4 + 2 + 1 = \mathbf{7}$
- $i=1$ 행 (2의 자리 비트가 만든 값들): $2^3 + 2^2 + 2^1 = 8 + 4 + 2 = \mathbf{14}$
- $i=2$ 행 (4의 자리 비트가 만든 값들): $2^4 + 2^3 + 2^2 = 16 + 8 + 4 = \mathbf{28}$
- $i=3$ 행 (8의 자리 비트가 만든 값들): $2^5 + 2^4 + 2^3 = 32 + 16 + 8 = \mathbf{56}$

이제 하드웨어가 최종 출력 레이어에서 이 행들의 결과를 모두 합하면 $$\text{최종 연산 결과} = 7 + 14 + 28 + 56 = \mathbf{105}$$. 즉 $2^{i+j}$만 있으면 연산을 할 수 있다. 그래도 어쨌든 $8 \times 8 = 64$번의 연산이 필요함. 0부분을 skip한다고 하더라도 이 경우에는 12번 즉, 1이 공통적으로 나오는 부분의 bit 수 만큼은 필요하다는 것임.

## 3. Laconic의 방식

Booth encoding이라는 방식을 통해 $\pm 2^x$형태로 $At_i$와 $Wt_j$가 생성돼서 $A \times W = \sum_{i=0}^{A_{terms}} \sum_{j=0}^{B_{terms}} At_i \times Wt_j$ 형태로 나오게 된다.

# ◼︎ LACONIC

## Booth encoding

십진수를 계산할 때 99,999 × 7을 하려면 9를 다섯 번이나 곱해야 하지만 이를 (100,000 - 1) × 7로 바꾸어 700,000 - 7 = 699,993으로 훨씬 쉽게 계산하는 방식을 2진수에 적용하는 방법임. 2진수에서 1이 연속으로 등장하는 구간(String of 1s)이 있을 때, 이를 시작점($+$)과 끝점($-$)의 단 두 개의 거듭제곱 항으로 변환하면 됨.

$\sum_{k=n}^{m} 2^k = 2^{m+1} - 2^n$


60을 일반 2진수로 표현하면 0011 1100이고 $\text{Value} = 2^5 + 2^4 + 2^3 + 2^2 = 32 + 16 + 8 + 4 = 60$임. 

Booth encoding을 사용하면 $2^6 - 2^2$로 변환함.즉, +2^6과 -2^2라는 단 2개의 부호가 있는 항(Terms)으로 $\text{Value} = 64 - 4 = 60$임.

부스 인코딩을 거친 거듭제곱 항($\pm 2^x$) 하나를 처리 장치로 보낼 때, 원본 8비트를 통째로 쓰지 않고 아래와 같은 **4비트 압축 포맷**으로 전선 신호를 인가함.

* **MSB (가장 왼쪽 1비트):** 부호(Sign) 비트 $\rightarrow$ **`0` = 양수(+)**, **`1` = 음수(-)**
* **LSB (나머지 3비트):** 지수(Exponent) 비트 $\rightarrow$ $0$부터 $7$까지의 자릿수를 2진수 3비트로 표현 (`000` ~ `111`)

### 1) 10진수 15 (`0000 1111`) 부스 인코딩 격자 시각화

원본 8비트 데이터에서 연속된 `1`의 뭉텅이를 찾아내어 **`+2^4`** 와 **`-2^0`** 단 2개의 4비트 패킷 라인으로 직렬 변환하는 과정입니다. (파란색 칸 = 부호 비트 / 흰색 칸 = 지수 비트)

#### ❶ 원본 8비트 데이터 (Raw Binary)
<table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, monospace; font-size: 0.85rem; margin: 10px 0;">
  <tr>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e0e0e0; color: #555555 !important; font-weight: bold;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e0e0e0; color: #555555 !important; font-weight: bold;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e0e0e0; color: #555555 !important; font-weight: bold;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e0e0e0; color: #555555 !important; font-weight: bold;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e3f2fd; font-weight: bold; color: #0d47a1 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e3f2fd; font-weight: bold; color: #0d47a1 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e3f2fd; font-weight: bold; color: #0d47a1 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e3f2fd; font-weight: bold; color: #0d47a1 !important;">1</td>
  </tr>
</table>

#### ❷ 변환된 4비트 하드웨어 직렬 패킷 (Term 1 & Term 2)
* **Cycle 0 : `+2^4` 항 (부호: + [0] / 지수: 4 [100])**
<table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, monospace; font-size: 0.85rem; margin: 5px 0 15px 0;">
  <tr>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
  </tr>
</table>

* **Cycle 1 : `-2^0` 항 (부호: - [1] / 지수: 0 [000])**
<table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, monospace; font-size: 0.85rem; margin: 5px 0;">
  <tr>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
  </tr>
</table>

---

### 2) 10진수 54 (`0011 0110`) 부스 인코딩 격자 시각화

내부 비트열에 `1` 뭉텅이가 두 군데로 쪼개져 있어, 부스 인코딩 시 **`+2^6`**, **`-2^4`**, **`+2^3`**, **`-2^1`** 총 4개의 패킷이 생성되어 4사이클 주기로 하드웨어 버스에 순차 인가됩니다.

#### ❶ 원본 8비트 데이터 (Raw Binary)
<table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, monospace; font-size: 0.85rem; margin: 10px 0;">
  <tr>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e0e0e0; color: #555555 !important; font-weight: bold;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e0e0e0; color: #555555 !important; font-weight: bold;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffecb3; font-weight: bold; color: #b75700 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffecb3; font-weight: bold; color: #b75700 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e0e0e0; color: #555555 !important; font-weight: bold;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e8f5e9; font-weight: bold; color: #1b5e20 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e8f5e9; font-weight: bold; color: #1b5e20 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #e0e0e0; color: #555555 !important; font-weight: bold;">0</td>
  </tr>
</table>

#### ❷ 변환된 4비트 하드웨어 직렬 패킷 (Term 1 ~ 4)
* **Cycle 0 : `+2^6` 항 (부호: + [0] / 지수: 6 [110])**
<table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, monospace; font-size: 0.85rem; margin: 5px 0 12px 0;">
  <tr>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
  </tr>
</table>

* **Cycle 1 : `-2^4` 항 (부호: - [1] / 지수: 4 [100])**
<table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, monospace; font-size: 0.85rem; margin: 5px 0 12px 0;">
  <tr>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
  </tr>
</table>

* **Cycle 2 : `+2^3` 항 (부호: + [0] / 지수: 3 [011])**
<table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, monospace; font-size: 0.85rem; margin: 5px 0 12px 0;">
  <tr>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">1</td>
  </tr>
</table>

* **Cycle 3 : `-2^1` 항 (부호: - [1] / 지수: 1 [010])**
<table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, monospace; font-size: 0.85rem; margin: 5px 0;">
  <tr>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">1</td>
    <td style="border: 1px solid #333333; width: 32px; height: 32px; background-color: #ffffff; font-weight: bold; color: #222222 !important;">0</td>
  </tr>
</table>

## 실제 계산

위에서 예시 그대로 가져와서 해보면 

$A = 15$ (0000 1111) $\rightarrow$ $16 - 1 = \mathbf{(+2^4, -2^0)}$ [유효 항 2개] 

 $W = 7$ (0000 0111) $\rightarrow$ $8 - 1 = \mathbf{(+2^3, -2^0)}$ [유효 항 2개]   

```text
 W의 유효 항    ──>    +2^3       -2^0
   A의 유효 항
       │
       ▼
     +2^4           [주기 1]    [주기 2]
                    +2^7       -2^4

     -2^0           [주기 3]    [주기 4]
                    -2^3       +2^0
```

- 1주기: $+2^4 \times +2^3 \rightarrow \text{지수 합: } 4+3=7 \rightarrow +2^7 = \mathbf{128}$   

- 2주기: $+2^4 \times -2^0 \rightarrow \text{지수 합: } 4+0=4 \rightarrow -2^4 = \mathbf{-16}$  

-  3주기: $-2^0 \times +2^3 \rightarrow \text{지수 합: } 0+3=3 \rightarrow -2^3 = \mathbf{-8}$   
  
- 4주기: $-2^0 \times -2^0 \rightarrow \text{지수 합: } 0+0=0 \rightarrow +2^0 = \mathbf{1}$  
 
최종적으로 $128 - 16 - 8 + 1 = 105$

<center><img src="/images/PR/Laconic/figure2.JPG" width = "700"><br></center>

(a)는 그냥 기본적인 bit 형태의 곱임. 그래서 8bit로 들어오고 있음. 그래서 4cycle이 필요함. (b)는 LPE(Laconic PE) 한개가 어떻게 연산이 되고 있는지 보여줌. 이 경우는 cycle수가 2가 됐음. (c)는 이 LPE를 결국 격자형태로 많이 깔면 cycle 자체는 많이 늘어나보여도 그냥 bit parallel PE에 계속 넣는거보다 병렬성이 좋아서 가속됨.

최악의 경우(Worst-case), 8비트 값은 부스 인코딩되었을 때 최대 5개의 항(Term)으로 쪼개짐(10101010 or 01010101). 이는 모든 입력 조건에서 라코닉이 기존 방식보다 항상 최소한 같거나 빠르려면 비트 병렬 PE 1개당 25개의 LPE가 필요함을 의미함.

근데 이래도 더 빠를수 밖에 없는 이유는 worst case가 아닐 확률이 훨신 높음(Bit sparsity 높다는 얘기). 그리고 결국 곱셈기보다 훨신 작기 때문에 여러개 붙여도 곱셈기 여러개 생기는 것보다 훨씬 빠른 속도임. 

## Activation and Weight Representation

일단 memory에서 booth encoding 된 숫자 형태는 비효율적이기 때문에 memory에서 값을 저장할때는 보통의 2진수 상태로 둠. 그리고 weight와 activation을 16channel로 한번에 가져오는게 balance 있다고 하는데 아마 이건 8bit에 16channel이라서 $8 \times 16 = 128$이라서 SRAM 크기에도 좋고 CNN 구조에서 filter를 $4 \times 4$로 많이 했다 보니 이때 filter의 channel은 정확히 16개이긴 함.

$$
\begin{aligned}
W \times A &= \sum_{\forall(s,t) \in W_{terms}} (-1)^s 2^t \times \sum_{\forall(s',t') \in A_{terms}} (-1)^{s'} 2^{t'} \\
&= ((-1)^{(s_0+s'_0)}2^{(t_0+t'_0)} + \dots + (-1)^{(s_0+s'_m)}2^{(t_0+t'_m)}) \\
&\quad + \dots + ((-1)^{(s_n+s'_0)}2^{(t_n+t'_0)} + \dots + (-1)^{(s_n+s'_m)}2^{(t_n+t'_m)})
\end{aligned}
$$

$s$는 weight 값의 sign bit $t$는 weight 값의 지수값 $s'$은 activation 값의 sign bit $t'$은 activation 값의 지수값임. 이걸 하드웨어적으로 만들면 figure 3와 같음.

### A Histogram-Based PE

<center><img src="/images/PR/Laconic/figure3.JPG" width = "800"><br></center>

여기서는 16 channel일때 흐름을 봄. 크게 6단계로 나눠짐. 

> **Step 1 : 지수 덧셈 및 부호 판별**
>
> 16개의 3비트 weight 지수 항($$(t_0 \dots t_{15})$$)과 sign bit($$(s_0 \dots s_{15})$$), 그리고 16개의 3비트 activation 지수 항($$(t'_0 \dots t'_{15})$$)과 sign bit($$(s'_0 \dots s'_{15})$$)를 입력받아 곱을 계산함. 지수들을 서로 더하여 4비트 크기(7+7 = 14)의 지수 결과물($$(t_0+t'_0) \dots (t_{15}+t'_{15})$$)을 생성하고, sign bit 끼리는 XOR 게이트로 $$E_{0\text{sign}} \dots E_{15\text{sign}}$$.
>
> ---
>
> **Step 2 : 디코더를 통한 원핫(One-hot) 변환**
>
> $i$번째 액티베이션 및 가중치 쌍($$i \in \{0 \dots 15\}$$)에 대하여, LPE는 **4b-to-16b 디코더**를 통해 $$2^{t_i+t'_i}$$를 계산함. 4비트 지수 합을 하나의 '1' 비트와 15개의 '0' 비트로 이루어진 16비트 one-hot format으로 변환(해당 자리수에 1이 active되는 형태)하며, 이 '1'의 위치는 부호 결과($$E_i.\text{sign}$$)에 따라 $+2^j$ 또는 $-2^j$ 값을 의미하게 됨.
>
> ---
>
> **Step 3 : 히스토그램 버킷 누적**
>
> Step 2에서 나온 16개의 16비트 숫자들을 **16개의 버킷($N^0 \dots N^{15}$)**에 누적하여 디코더 출력값들의 히스토그램을 생성함. 16개의 버킷은 $2^0 \dots 2^{15}$ 자릿수에 대응합니다. 버킷은 최대 16개의 부호가 있는 입력을 받으므로 최종 카운트 범위는 $[-16 \dots 16]$이 되며, **2의 보수 형태의 6비트**로 표현됨.
>
> ---
>
> **Step 4 : 비트 결합을 통한 가산기 제거**
>
> 원래는 16개의 6비트 카운트 값들을  shift를 거쳐 16입력 가산기 트리를 써야 하지만 Laconic은 비트 자리가 절대 겹치지 않는 버킷 구조를 활용하여 전선을 그대로 이어 붙이는 **Concatenation** 을 사용함.
>
> ---
>
> **Step 5 : 압축된 가산기 트리 연산**
>
> Step 4에서 전선 결합으로 1차 압축된 값들은 최종 **6입력 가산기 트리**를 통해 더해져 최종 **22비트 크기의 partial sum**을 도출함.
>
> ---
>
> **Step 6 : 최종 psum 누적**
>
> 이전 단계에서 도출된 부분합이 **psum accumulator**에 최종 누적됨. 





