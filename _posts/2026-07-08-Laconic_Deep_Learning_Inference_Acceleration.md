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

# Bit Sparsity Is Abundant

