---
layout: single
title: "Laconic Deep Learning Inference Acceleration, ISCA 2019"
categories: Paper_review
tags: PR
toc: true
author_profile: false
paper_venue: "ISCA 2019"
paper_year: 2019
paper_authors: "Sayeh Sharify, Alberto Delmas Lascorz, Patrick Judd, Andreas Moshovos"
paper_link: "https://dl.acm.org/doi/10.1145/3307650.3322255"
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

<center><img src="/images/PR/Laconic/figure3.jpg" width = "800"><br></center>

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

<div class="lpe-container">

  <style>
    /* 🎨 1. 보내주신 SCSS 테마 컬러 고정 매핑 ($background-color, $text-color) */
    .lpe-container { 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
      background-color: #252a34 !important; /* 이미지의 딥 그레이 배경색 고정 */
      color: #eaeaea !important;            /* 데이모드에서도 묻히지 않도록 글자색 고정 */
      line-height: 1.6; 
      padding: 20px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    
    .lpe-title { font-size: 0.9rem; font-weight: bold; margin-bottom: 0; color: #eaeaea; }
    .lpe-hr { border: 0; border-top: 1px solid rgba(255, 255, 255, 0.15); margin: 12px 0; }
    .lpe-section { border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 14px; margin-bottom: 14px; }
    
    /* 포인트 컬러 테마 매핑 */
    .lpe-stitle { margin-top: 0; margin-bottom: 6px; font-weight: bold; color: #89dce2; font-size: 0.85rem; }
    .lpe-desc { font-size: 0.72rem; color: rgba(255, 255, 255, 0.6); margin-bottom: 8px; }
    
    /* 📊 2. 표(Table) 내부 배경색을 코드 블록 단(#171717)과 동기화하여 시인성 확보 */
    .lpe-table { 
    display: table !important;       /* 1. 테마가 display: block으로 바꾸는 버그 방지 */
    width: auto !important;          /* 2. width: 100%를 해제해야 margin auto가 작동함 */
    margin: 0 auto !important;       /* 3. 테마의 margin-left: 0을 강제로 짓누르고 중앙 정렬 */
    border-collapse: collapse; 
    text-align: center; 
    font-size: 0.72rem; 
    min-width: 550px; 
    border: 1px solid rgba(255, 255, 255, 0.15); 
    background-color: #171717; 
    }
    .lpe-table th { padding: 6px; border: 1px solid rgba(255, 255, 255, 0.1); font-weight: 600; background-color: rgb(56, 56, 56); color: #eaeaea; ; text-align: center !important;}
    .lpe-table td { padding: 6px; border: 1px solid rgba(255, 255, 255, 0.1); color: #eaeaea; }
    
    /* 🧬 3. 플렉스 정렬 (글자 크기 축소 튜닝) */
    .lpe-flex-row { display: flex; align-items: center; margin-bottom: 5px; font-size: 0.72rem; overflow-x: auto; white-space: nowrap; color: #eaeaea; }
    .lpe-label { font-weight: bold; width: 75px; flex-shrink: 0; color: rgba(255, 255, 255, 0.7); }
    
    /* 🎛️ 4. 고정폭 글씨체 ($font-mono) 매핑 및 비트 박스 대비 최적화 */
    .bit-box { 
      display: inline-block; 
      width: 13px; 
      height: 16px; 
      line-height: 16px; 
      text-align: center; 
      border: 1px solid rgba(255, 255, 255, 0.2); 
      background: rgba(0, 0, 0, 0.25); 
      font-family: "JetBrains Mono", "Fira Code", SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; 
      font-size: 11px; 
      margin-right: 2px; 
      border-radius: 2px; 
      vertical-align: middle; 
      color: #eaeaea; 
    }
    
    /* 포인트 하이라이트 색상 채도 다운 안착 */
    .bit-box.act-pos { border-color: rgba(0, 173, 181, 0.7); background: rgba(0, 173, 181, 0.2); color: #00adb5; font-weight: bold; }
    .bit-box.act-neg { border-color: rgba(219, 114, 114, 0.7); background: rgba(219, 114, 114, 0.2); color: #db7272; font-weight: bold; }
    .bit-box.act-green { border-color: rgba(16, 185, 129, 0.7); background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: bold; }
    
    .bit-guide { font-family: "JetBrains Mono", "Fira Code", monospace; font-size: 9px; color: rgba(255, 255, 255, 0.4); margin-left: 75px; margin-bottom: 2px; display: flex; }
    .bit-idx { width: 15px; margin-right: 2px; text-align: center; }
  </style>

  <p class="lpe-title">4 Channel Example</p>
  <hr class="lpe-hr">

  <div class="lpe-section">
    <p class="lpe-stitle">■ Setting</p>
    <div style="overflow-x: auto;">
      <table class="lpe-table">
        <thead>
          <tr style="border-bottom: 2px solid #ffffff57;">
            <th>입력 채널</th>
            <th style="color: #89dce2;"><i>t<sub>i</sub></i></th>
            <th style="color: #89dce2;"><i>t'<sub>i</sub></i></th>
            <th style="color: #db7272;"><i>s<sub>i</sub></i></th>
            <th style="color: #db7272;"><i>s'<sub>i</sub></i></th>
            <th style="color: #58cea6; font-weight: bold;">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
            <td style="font-weight: bold; background-color: rgba(0, 0, 0, 0.15);">Ch 0</td>
            <td>1 (3b'001)</td>
            <td>1 (3b'001)</td>
            <td style="color: #89dce2;">0 (+)</td>
            <td style="color: #89dce2;">0 (+)</td>
            <td style="font-weight: bold; color: #58cea6;">+2¹ × 2¹ = +4</td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
            <td style="font-weight: bold; background-color: rgba(0, 0, 0, 0.15);">Ch 1</td>
            <td>2 (3b'010)</td>
            <td>0 (3b'000)</td>
            <td style="color: #db7272; font-weight: bold;">1 (-)</td>
            <td style="color: #89dce2;">0 (+)</td>
            <td style="font-weight: bold; color: #58cea6;">-2² × 2⁰ = -4</td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
            <td style="font-weight: bold; background-color: rgba(0, 0, 0, 0.15);">Ch 2</td>
            <td>2 (3b'010)</td>
            <td>1 (3b'001)</td>
            <td style="color: #89dce2;">0 (+)</td>
            <td style="color: #89dce2;">0 (+)</td>
            <td style="font-weight: bold; color: #58cea6;">+2² × 2¹ = +8</td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
            <td style="font-weight: bold; background-color: rgba(0, 0, 0, 0.15);">Ch 3</td>
            <td>0 (3b'000)</td>
            <td>1 (3b'001)</td>
            <td style="color: #89dce2;">0 (+)</td>
            <td style="color: #89dce2;">0 (+)</td>
            <td style="font-weight: bold; color: #58cea6;">+2⁰ × 2¹ = +2</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size: 0.76rem; color: rgba(255,255,255,0.7); margin-top: 4px; margin-bottom: 0;"> 최종적으로 +4-4+8+2 = <b>10</b>이 나와야 함.</p>
    </div>
  </div>

  <div class="lpe-section">
    <p class="lpe-stitle">■ Step 1</p>
    <div style="font-size: 0.72rem; line-height: 1.8; color: #eaeaea;">
      <div class="lpe-flex-row">
        <span class="lpe-label">Ch 0 :</span>
        지수 합(1+1=2) &nbsp;<span class="bit-box">0</span><span class="bit-box">0</span><span class="bit-box act-pos">1</span><span class="bit-box">0</span> ｜ 부호(0⊕0=0) &nbsp;<span class="bit-box act-pos">0</span> (+)
      </div>
      <div class="lpe-flex-row">
        <span class="lpe-label">Ch 1 :</span>
        지수 합(2+0=2) &nbsp;<span class="bit-box">0</span><span class="bit-box">0</span><span class="bit-box act-pos">1</span><span class="bit-box">0</span> ｜ 부호(1⊕0=1) &nbsp;<span class="bit-box act-neg">1</span> (-)
      </div>
      <div class="lpe-flex-row">
        <span class="lpe-label">Ch 2 :</span>
        지수 합(2+1=3) &nbsp;<span class="bit-box">0</span><span class="bit-box">0</span><span class="bit-box act-pos">1</span><span class="bit-box act-pos">1</span> ｜ 부호(0⊕0=0) &nbsp;<span class="bit-box act-pos">0</span> (+)
      </div>
      <div class="lpe-flex-row">
        <span class="lpe-label">Ch 3 :</span>
        지수 합(0+1=1) &nbsp;<span class="bit-box">0</span><span class="bit-box">0</span><span class="bit-box">0</span><span class="bit-box act-pos">1</span> ｜ 부호(0⊕0=0) &nbsp;<span class="bit-box act-pos">0</span> (+)
      </div>
    </div>
  </div>

  <div class="lpe-section">
    <p class="lpe-stitle">■ Step 2</p>
    
    <div style="overflow-x: auto;">
      <table class="lpe-bit-table">
        <tr>
          <td class="lpe-label"></td>
          <td class="bit-idx-td">15</td><td class="bit-idx-td">14</td><td class="bit-idx-td">13</td><td class="bit-idx-td">12</td>
          <td class="bit-idx-td">11</td><td class="bit-idx-td">10</td><td class="bit-idx-td">9</td><td class="bit-idx-td">8</td>
          <td class="bit-idx-td">7</td><td class="bit-idx-td">6</td><td class="bit-idx-td">5</td><td class="bit-idx-td">4</td>
          <td class="bit-idx-td">3</td><td class="bit-idx-td">2</td><td class="bit-idx-td">1</td><td class="bit-idx-td">0</td>
        </tr>
        <tr>
          <td class="lpe-label">Ch 0 (E=2):</td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box act-green">1</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
        </tr>
        <tr>
          <td class="lpe-label">Ch 1 (E=2):</td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box act-green">1</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
        </tr>
        <tr>
          <td class="lpe-label">Ch 2 (E=3):</td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box act-green">1</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
        </tr>
        <tr>
          <td class="lpe-label">Ch 3 (E=1):</td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td>
          <td><span class="bit-box">0</span></td><td><span class="bit-box">0</span></td><td><span class="bit-box act-green">1</span></td><td><span class="bit-box">0</span></td>
        </tr>
      </table>
    </div>
  </div>

  <div class="lpe-section">
    <p class="lpe-stitle">■ Step 3</p>
    <div style="overflow-x: auto;">
      <table class="lpe-table">
        <thead>
          <tr style="background-color: rgba(0, 0, 0, 0.2); border-bottom: 2px solid #00adb5; font-weight: bold;">
            <th style="width: 14%; color: rgba(255, 255, 255, 0.7);">담당 버킷</th>
            <th style="color: #89dce2;">Ch 0 <br><span style="font-size:0.65rem; color:rgba(255,255,255,0.4);">[MSB,LSB]</span></th>
            <th style="color: #db7272;">Ch 1 <br><span style="font-size:0.65rem; color:rgba(255,255,255,0.4);">[MSB,LSB]</span></th>
            <th style="color: #89dce2;">Ch 2 <br><span style="font-size:0.65rem; color:rgba(255,255,255,0.4);">[MSB,LSB]</span></th>
            <th style="color: #89dce2;">Ch 3 <br><span style="font-size:0.65rem; color:rgba(255,255,255,0.4);">[MSB,LSB]</span></th>
            <th style="color: #caa06d; width: 12%;">Caculation</th>
            <th style="color: #58cea6; width: 28%;">Output (<i>N<sup>j</sup></i>)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: bold; background-color: rgba(0, 0, 0, 0.15);">버킷 <i>N</i>¹ (2¹)</td>
            <td style="color: rgba(255, 255, 255, 0.25);">[0][0]</td>
            <td style="color: rgba(255, 255, 255, 0.25);">[0][0]</td>
            <td style="color: rgba(255, 255, 255, 0.25);">[0][0]</td>
            <td style="background: rgba(0, 173, 181, 0.06);"><span style="border:1px solid rgba(0, 173, 181, 0.5); background:rgba(0, 173, 181, 0.12); padding:1px 3px; font-weight:bold; color:#00adb5; border-radius:2px;">[0][1]</span></td>
            <td>1 - 0 = 1</td>
            <td style="font-family:monospace; font-weight:bold; color:#10b981;"><span style="border:1px solid rgba(16, 185, 129, 0.5); background:rgba(16, 185, 129, 0.12); padding:1px 3px; border-radius:2px;">[0][0][0][0][0][1]</span> (+1)</td>
          </tr>
          <tr style="background-color: rgba(0, 0, 0, 0.08);">
            <td style="font-weight: bold; background-color: rgba(0, 0, 0, 0.15);">버킷 <i>N</i>² (2²)</td>
            <td style="background: rgba(0, 173, 181, 0.06);"><span style="border:1px solid rgba(0, 173, 181, 0.5); background:rgba(0, 173, 181, 0.12); padding:1px 3px; font-weight:bold; color:#00adb5; border-radius:2px;">[0][1]</span></td>
            <td style="background: rgba(219, 114, 114, 0.06);"><span style="border:1px solid rgba(219, 114, 114, 0.5); background:rgba(219, 114, 114, 0.12); padding:1px 3px; font-weight:bold; color:#db7272; border-radius:2px;">[1][1]</span></td>
            <td style="color: rgba(255, 255, 255, 0.25);">[0][0]</td>
            <td style="color: rgba(255, 255, 255, 0.25);">[0][0]</td>
            <td style="color: #caa06d; font-weight: bold; background: rgba(202,160,109,0.03);">
              1 - 1 = 0<br>
            </td>
            <td style="font-family:monospace; font-weight:bold; color:rgba(255, 255, 255, 0.4);"><span style="border:1px solid rgba(255, 255, 255, 0.15); background:rgba(0, 0, 0, 0.1); padding:1px 3px; border-radius:2px;">[0][0][0][0][0][0]</span> (0)</td>
          </tr>
          <tr>
            <td style="font-weight: bold; background-color: rgba(0, 0, 0, 0.15);">버킷 <i>N</i>³ (2³)</td>
            <td style="color: rgba(255, 255, 255, 0.25);">[0][0]</td>
            <td style="color: rgba(255, 255, 255, 0.25);">[0][0]</td>
            <td style="background: rgba(0, 173, 181, 0.06);"><span style="border:1px solid rgba(0, 173, 181, 0.5); background:rgba(0, 173, 181, 0.12); padding:1px 3px; font-weight:bold; color:#00adb5; border-radius:2px;">[0][1]</span></td>
            <td style="color: rgba(255, 255, 255, 0.25);">[0][0]</td>
            <td>1 - 0 = 1</td>
            <td style="font-family:monospace; font-weight:bold; color:#10b981;"><span style="border:1px solid rgba(16, 185, 129, 0.5); background:rgba(16, 185, 129, 0.12); padding:1px 3px; border-radius:2px;">[0][0][0][0][0][1]</span> (+1)</td>
          </tr>
        </tbody>
      </table>
      <p style="font-size: 0.76rem; color: rgba(255,255,255,0.7); margin-top: 4px; margin-bottom: 0;"> 총 6bit로 맨 왼쪽(MSB) 1bit가 sign bit 이고 1111+1111 = 10000를 나타내야하니까 하위 5bit가 필요함</p>
    </div>
  </div>

  <div class="lpe-section">
    <p class="lpe-stitle">■ Step 4</p>
    <p style="font-size: 0.76rem; color: rgba(255,255,255,0.7); margin-top: 4px; margin-bottom: 0;">원래는 shift 해야하지만 wire로 분리돼있어서 하드웨어적으로는 그냥 사용하면 됨</p>
  </div>

  <div class="lpe-section">
    <p class="lpe-stitle">■ Step 5</p>
    <div style="background-color: rgba(0, 0, 0, 0.2); padding: 8px; border-radius: 6px; font-family: monospace; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.78rem;">
      <span style="color: rgba(255,255,255,0.6);">$$\text{psum} = (N^1 \ll 1) + (N^2 \ll 2) + (N^3 \ll 3)$$</span><br>
      <span style="color: #ccba69; font-weight: bold;">$$\text{psum} = (1 \times 2) + (0 \times 4) + (1 \times 8) = 2 + 0 + 8 = 10$$</span>
    </div>
  </div>

  <div style="padding-bottom: 4px;">
    <p class="lpe-stitle">■ Step 6</p>
    <p style="font-size: 0.76rem; color: rgba(255,255,255,0.7); margin-top: 4px; margin-bottom: 0;"><b>psum = 10</b>과 다음 cycle에 나올 다른 psum들을 합침</p>
  </div>

</div>

###  Shrinking the Adder Tree

원래는 step 4에서 shift 해서 자리수 맞춰주고 16개의 값을 다 더하면 16 to 1 adder tree를 써서 굉장히 비효율적임. 근데 이걸 더 작은 6 to 1 adder tree로 줄여서 사용할 수 있다. 우선 $$N^6$$의 경우 $$<<6$$을 하게 됨. 이걸 수식으로 나타내면 아래처럼 씀.

$$\begin{aligned}
N^6 \times 2^6 + N^0 =&\ \\
\text{1) if } n_5^0 = 0: =&\ n_5^6 n_4^6 n_3^6 n_2^6 n_1^6 n_0^6 000000 + 000000 n_5^0 n_4^0 n_3^0 n_2^0 n_1^0 n_0^0 \\
=&\ n_5^6 n_4^6 n_3^6 n_2^6 n_1^6 n_0^6 n_5^0 n_4^0 n_3^0 n_2^0 n_1^0 n_0^0 = \{N^6, N^0\} \\
\text{2) if } n_5^0 = 1: =&\ n_5^6 n_4^6 n_3^6 n_2^6 n_1^6 n_0^6 000000 + 111111 n_5^0 n_4^0 n_3^0 n_2^0 n_1^0 n_0^0 \\
=&\ (n_5^6+1)(n_4^6+1)(n_3^6+1)(n_2^6+1) \cdots \\
&\ \cdots (n_1^6+1)(n_0^6+1)n_5^0 n_4^0 n_3^0 n_2^0 n_1^0 n_0^0 = \{(N^6-1), N^0\}
\end{aligned}
$$

이렇게 두면 이해하기 어려우니 실제 수식으로 보여주면 

$$N^6 = 5$$(000101)일 때, 

1. Case 1: $$N^0 = 3$$ (000011), $$5 \times 2^6 + 3 = 320 + 3 = 323$$

2. Case 2: $$N^0 = -3$$ (111101), $$5 \times 2^6 + (-3) = 320 - 3 = 317$$


#### Case 1
<table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85rem; margin: 15px 0 25px 0;">
  <tr style="font-size: 0.75rem; opacity: 0.8;">
    <td style="text-align: left; font-weight: bold; padding-right: 15px;">Bit Position</td>
    <td style="width: 36px; height: 32px;">11</td>
    <td style="width: 36px;">10</td>
    <td style="width: 36px;">9</td>
    <td style="width: 36px;">8</td>
    <td style="width: 36px;">7</td>
    <td style="width: 36px; border-right: 2px dashed #888888;">6</td>
    <td style="width: 36px;">5</td>
    <td style="width: 36px;">4</td>
    <td style="width: 36px;">3</td>
    <td style="width: 36px;">2</td>
    <td style="width: 36px;">1</td>
    <td style="width: 36px;">0</td>
  </tr>
  
  <tr>
    <td style="text-align: left; font-weight: bold; padding-right: 15px;">N⁶ ≪ 6 (5 ≪ 6)</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; height: 32px;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">0</td>
    <td style="border: 1px solid #666666; border-right: 2px solid #333333; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
  </tr>
  
  <tr>
    <td style="text-align: left; font-weight: bold; font-size: 0.8rem; padding: 4px 0;">+ (CONCAT)</td>
    <td colspan="6" style="border-right: 2px dashed #888888;"></td>
    <td colspan="6"></td>
  </tr>
  
  <tr>
    <td style="text-align: left; font-weight: bold; padding-right: 15px;">N⁰ (3)</td>
    <td></td><td></td><td></td><td></td><td></td>
    <td style="border-right: 2px dashed #888888;"></td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; height: 32px;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">1</td>
  </tr>
  
  <tr>
    <td colspan="13" style="border-bottom: 2px solid #666666; height: 6px;"></td>
  </tr>
  
  <tr>
    <td style="text-align: left; font-weight: bold; padding-top: 6px;">결과 (323)</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px; height: 32px;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px;">1</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; border-right: 2px solid #333333; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">1</td>
  </tr>
</table>

#### Case 2
<table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85rem; margin: 15px 0 25px 0;">
  <tr style="font-size: 0.75rem; opacity: 0.8;">
    <td style="text-align: left; font-weight: bold; padding-right: 15px;">Bit Position</td>
    <td style="width: 36px; height: 32px;">11</td>
    <td style="width: 36px;">10</td>
    <td style="width: 36px;">9</td>
    <td style="width: 36px;">8</td>
    <td style="width: 36px;">7</td>
    <td style="width: 36px; border-right: 2px dashed #888888;">6</td>
    <td style="width: 36px;">5</td>
    <td style="width: 36px;">4</td>
    <td style="width: 36px;">3</td>
    <td style="width: 36px;">2</td>
    <td style="width: 36px;">1</td>
    <td style="width: 36px;">0</td>
  </tr>
  
  <tr>
    <td style="text-align: left; font-weight: bold; padding-right: 15px;">N⁶ ≪ 6 (5 ≪ 6)</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; height: 32px;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">0</td>
    <td style="border: 1px solid #666666; border-right: 2px solid #333333; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #e0e0e0; font-weight: bold; color: #555555 !important;">0</td>
  </tr>
  
  <tr>
    <td style="text-align: left; font-weight: bold; font-size: 0.8rem; padding: 4px 0;">+ (ADD)</td>
    <td colspan="6" style="border-right: 2px dashed #888888;"></td>
    <td colspan="6"></td>
  </tr>
  
  <tr>
    <td style="text-align: left; font-weight: bold; padding-right: 15px;">N⁰ 부호 확장 (-3)</td>
    <td style="border: 1px solid #666666; background-color: #ffcc80; font-weight: bold; color: #b25e00 !important; height: 32px;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffcc80; font-weight: bold; color: #b25e00 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffcc80; font-weight: bold; color: #b25e00 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffcc80; font-weight: bold; color: #b25e00 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffcc80; font-weight: bold; color: #b25e00 !important;">1</td>
    <td style="border: 1px solid #666666; border-right: 2px solid #333333; background-color: #ffcc80; font-weight: bold; color: #b25e00 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important;">1</td>
  </tr>
  
  <tr>
    <td colspan="13" style="border-bottom: 2px solid #666666; height: 6px;"></td>
  </tr>
  
  <tr>
    <td style="text-align: left; font-weight: bold; padding-top: 6px;">산술 결과 (317)</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px; height: 32px;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px;">1</td>
    <td style="border: 1px solid #666666; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; border-right: 2px solid #333333; background-color: #bbdefb; font-weight: bold; color: #0d47a1 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">1</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">0</td>
    <td style="border: 1px solid #666666; background-color: #ffe0b2; font-weight: bold; color: #e65100 !important; padding-top: 6px;">1</td>
  </tr>
</table>

case 2 일때 보면 12자리수에 어짜피 더해진 1값은 버려져서 결국 값은 317이 나오게 됨. 즉 서로 6씩 shift 된 $$N$$값들은 서로 영향을 안끼침. 그래서 $$N^6$$은 $$N^12$$와도 같은 관계이므로 이런 관계의 $$N$$값 끼리 묶어주면 

$$
\begin{aligned}
G_0 = \{N^{12}, N^6, N^0\}, \quad G_1 = \{N^{13}, N^7, N^1\}, \quad G_2 = \{N^{14}, N^8, N^2\}, \\
G_3 = \{N^{15}, N^9, N^3\}, \quad G_4 = \{N^{10}, N^4\}, \quad G_5 = \{N^{11}, N^5\}
\end{aligned}
$$

으로 표현 가능하고 

$$psum = \sum_{i=0}^{5} (G_i \ll i)$$

최종적으로 이렇게 6개의 18bit의 값만 합산 하면 됨. 이걸 보여주는 것이 figure 3(b)임.

<div style="width: 100%; overflow-x: auto; margin: 20px 0;">
  <table style="border-collapse: collapse; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.8rem; min-width: 850px; width: 100%;">
    
    <tr style="opacity: 0.7; font-size: 0.75rem; height: 30px;">
      <td style="text-align: left; font-weight: bold; width: 140px;">Bit Position</td>
      <td style="width: 4%;">21</td><td style="width: 4%;">20</td><td style="width: 4%;">19</td><td style="width: 4%;">18</td>
      <td style="width: 4%;">17</td><td style="width: 4%;">16</td><td style="width: 4%;">15</td><td style="width: 4%;">14</td>
      <td style="width: 4%;">13</td><td style="width: 4%;">12</td><td style="width: 4%;">11</td><td style="width: 4%;">10</td>
      <td style="width: 4%;">9</td><td style="width: 4%;">8</td><td style="width: 4%;">7</td><td style="width: 4%;">6</td>
      <td style="width: 4%;">5</td><td style="width: 4%;">4</td><td style="width: 4%;">3</td><td style="width: 4%;">2</td>
      <td style="width: 4%;">1</td><td style="width: 4%;">0</td>
    </tr>

    <tr style="height: 36px;">
      <td style="text-align: left; font-weight: bold;">G₀ ≪ 0 (18-bit)</td>
      <td colspan="4" style="border: 1px solid #cbd5e1; background-color: #f3f4f6; color: #555555 !important; font-style: italic; font-weight: bold;">sign ext.</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #bbdefb; color: #0d47a1; font-weight: bold;">N¹²</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #bbdefb; color: #0d47a1; font-weight: bold;">N⁶</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #bbdefb; color: #0d47a1; font-weight: bold;">N⁰</td>
    </tr>

    <tr style="height: 36px;">
      <td style="text-align: left; font-weight: bold;">G₁ ≪ 1 (18-bit)</td>
      <td colspan="3" style="border: 1px solid #cbd5e1; background-color: #f3f4f6; color: #555555 !important; font-style: italic; font-weight: bold;">sign ext.</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #b2dfdb; color: #004d40; font-weight: bold;">N¹³</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #b2dfdb; color: #004d40; font-weight: bold;">N⁷</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #b2dfdb; color: #004d40; font-weight: bold;">N¹</td>
      <td colspan="1" style="border: 1px solid #cbd5e1; background-color: #e5e7eb; color: #4b5563; font-weight: bold;">0</td>
    </tr>

    <tr style="height: 36px;">
      <td style="text-align: left; font-weight: bold;">G₂ ≪ 2 (18-bit)</td>
      <td colspan="2" style="border: 1px solid #cbd5e1; background-color: #f3f4f6; color: #555555 !important; font-style: italic; font-weight: bold;">sign ext.</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #c8e6c9; color: #1b5e20; font-weight: bold;">N¹⁴</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #c8e6c9; color: #1b5e20; font-weight: bold;">N⁸</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #c8e6c9; color: #1b5e20; font-weight: bold;">N²</td>
      <td colspan="2" style="border: 1px solid #cbd5e1; background-color: #e5e7eb; color: #4b5563; font-weight: bold;">0</td>
    </tr>

    <tr style="height: 36px;">
      <td style="text-align: left; font-weight: bold;">G₃ ≪ 3 (18-bit)</td>
      <td colspan="1" style="border: 1px solid #cbd5e1; background-color: #f3f4f6; color: #555555 !important; font-style: italic; font-weight: bold;">s</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #e1bee7; color: #4a148c; font-weight: bold;">N¹⁵</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #e1bee7; color: #4a148c; font-weight: bold;">N⁹</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #e1bee7; color: #4a148c; font-weight: bold;">N³</td>
      <td colspan="3" style="border: 1px solid #cbd5e1; background-color: #e5e7eb; color: #4b5563; font-weight: bold;">0</td>
    </tr>

    <tr style="height: 36px;">
      <td style="text-align: left; font-weight: bold;">G₄ ≪ 4 (12-bit)</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #f3f4f6; color: #555555 !important; font-style: italic; font-weight: bold;">sign ext.</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #ffe0b2; color: #e65100; font-weight: bold;">N¹⁰</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #ffe0b2; color: #e65100; font-weight: bold;">N⁴</td>
      <td colspan="4" style="border: 1px solid #cbd5e1; background-color: #e5e7eb; color: #4b5563; font-weight: bold;">0</td>
    </tr>

    <tr style="height: 36px;">
      <td style="text-align: left; font-weight: bold;">G₅ ≪ 5 (12-bit)</td>
      <td colspan="5" style="border: 1px solid #cbd5e1; background-color: #f3f4f6; color: #555555 !important; font-style: italic; font-weight: bold;">sign ext.</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #ffcdd2; color: #b71c1c; font-weight: bold;">N¹¹</td>
      <td colspan="6" style="border: 1px solid #cbd5e1; background-color: #ffcdd2; color: #b71c1c; font-weight: bold;">N⁵</td>
      <td colspan="5" style="border: 1px solid #cbd5e1; background-color: #e5e7eb; color: #4b5563; font-weight: bold;">0</td>
    </tr>

    <tr>
      <td colspan="23" style="border-bottom: 2px solid #333333; height: 10px;"></td>
    </tr>

    <tr>
      <td style="text-align: left; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;">6-Input Adder Tree</td>
      <td colspan="22" style="border: 2px solid #2e7d32; background-color: #a5d6a7; color: #1b5e20; font-weight: bold; height: 42px; font-size: 0.9rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;">
        최종 22-bit 부분합 출력 수 정렬 결과 (psum)
      </td>
    </tr>
  </table>
</div>

###  A Lower Area Histogram

Figure 3에서 (2)one-hot과 (3)histogram 사이에 $$D_0^0, D_0^1, D_0^2, \dots, D_0^{15}$$이 16개 그대로 들어가지만 이것보다 $$(D_0^0, D_0^1), (D_0^2, D_0^3) \dots ,(D_0^{14}, D_0^{15})$$ 이렇게 둘씩 짝지어서 8개 씩 들어감.

## Tile Organization


<center><img src="/images/PR/Laconic/figure4.jpg" width = "800"><br></center>

지금까지 하나의 LPE에 대해서 했지만 tile처럼 여러개의 LPE를 깔면 병렬적으로 한번에 처리 가능하고 어짜피 연산에는 수십 cycle이 걸리기 때문에 data의 병목도 생기지 않음.

## Tile Synchronization

또 이렇게 tile로 두면 문제는 term의 개수가 다르다는 것임. 이렇게 되면 어떤건 빠르게 끝나고 어떤건 느리게 끝남. Barrier 방식을 사용하면 제일 느린 LPE가 연산을 끝날때 까지 stall 했다가 다음 것을 하면 되는데 이러면 buble이 심해짐. 그래서 Com Synchronization이라는 대안을 내고 앞에 queue buffer를 달아줘서 해결함.

##  Data Type Composability

8b 말고도 16b를 써야할 수 도 있는데 그럴때는 figure 4의 (c)처럼 확장하면 됨. Composer 열을 추가하면 됨. 그리고 9b나 10b처럼 미세한 정밀도를 요구할 때는 booth encoder의 scheduling을 이용하면 가능함.

# ◼︎ Evaluation

전체적으로 빨라지고 에너지 효율도 좋아졌지만 Inception V3 에서는 에너지 효율에서는 오히려 손해가 있었고 1b/2b 급의 압축된 모델에서는 오히려 성능과 효율 모두 손해였음. 즉, bit 크기가 어느정도는 있어야 하고 에너지 효율이 살짝씩 떨어질 가능성은 존재함.




