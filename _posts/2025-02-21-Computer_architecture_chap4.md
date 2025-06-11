---
layout: single
title: "CA - chapter 4 The Processor - Datapath and Control"
categories: Computer_architecture
tags: CA
toc: true
author_profile: false
---

앞에서는 성능과 명령어에 대하여 알아보았다. 이번 장에서는 하드웨어가 어떤식으로 구조가 돼있는지에 대해 배울 예정이다. 

# ◼︎ 기본적인 RISC-V 구현

RISC-V의 핵심적인 부분은 3가지로 나뉜다.

* 메모리 참조 명령어(Memory-reference instruction): ld, sd
* 산술/논리 명령어(arithmetic-logical instruction): add, sub, and, or
* 조건부 분기 명령어(conditional branch instruction): beq


# ◼︎ 구현에 대한 개요

어떤 명령어를 선택하던 무조건 동일하게 해야하는 첫 과정이 있다. 

## First two steps

1. 프로그램 카운터(PC)를 프로그램이 저장되어 있는 메모리로 보내서 메모리로부터 명령어를 가져오는(fetch) 것.
2. 한 개 또는 2개의 레지스터를 읽는것. 

이 이후 과정들은 명령어가 뭐든 거의 같은 행동을 한다. 보통 레지스터를 읽고 ALU를 사용하게 된다. 

## Abstract view of RISC-V

<center><img src="/images/CO/chap4_abst.png" width = "700"></center><br>

이것은 추상적인 RISC-V의 구조이다. 자세히 보면 input이 2개가 되는 지점들이 보일것이다. 이 구조가 추상적인 이유는 실제로는 이런 지점에 multiplexer가 포함되어야 하기 때문이다. <br>

우선 모든 명령어의 실행은 PC를 사용하여 instruction memory에 명령어 주소를 보내는 것으로 시작된다. Instruction이 fetch되고 나면 register operand를 알 수 있게 된다. Operand를 보고 어떤 명령어를 실행해야하는지 알 수 있다. Arithmetic-logical instruction인 경우는 ALU의 결과를 레지스터에 쓴다. Load나 store이면 ALU 결과를 메모리 주소로 사용해서 레지스터 파일에 넣게된다. Branch의 경우는 ALU출력을 사용하여 다음 명령어 주소를 결정하게 되는데, 이 주소는 오른쪽 adder에서 PC+offset값이나 왼쪽 adder의 PC+4를 한 값이 된다. 

### Arithmetric-logical

<center><img src="/images/CO/chap4_abst_ari.png" width = "700"></center><br>

### Load & store

<center><img src="/images/CO/chap4_abst_ls.png" width = "700"></center><br>

### Branch

<center><img src="/images/CO/chap4_abst_beq.png" width = "700"></center><br>

위에서 언급했듯 multiplexer와 그 multiplexer를 control하기 위한 controller가 필요하다. 
<center><img src="/images/CO/chap4_w_mul.png" width = "700"></center><br>

# ◼︎ 클럭킹 방법론 (clocking methodology)

이것은 신호를 언제 읽고 쓰는지를 정의한다. 읽고 쓰기가 동시에 되면 어떤값이 과거값이고 현재값인지가 구분이 안되기 때문에 이를 용납하지 않는다.

## Edge-triggered clocking

소자에 저장된 값은 clock edge에서만 바꿀 수 있는 방법이다. 

<center><img src="/images/CO/chap4_clock_cycle.png" width = "700"></center><br>

이 클락은 D-FF(Delay FlipFlop)에 의해 input과 output이 delay 되어 출력되는 것을 통해 구현된다.

# ◼︎ 데이터패스 만들기(Building a Datapath)

앞에서도 말했듯 어떤 명령어든 2개의 step은 항상 거친다고 하였다. PC에서 주소값 받아오고 insturtion memory로 input을 넣어 fetch 하는 것이었다.

## Fetching instruction

<center><img src="/images/CO/chap4_fetch.png" width = "700"></center><br>

Fetching instruction은 이 3가지의 요소 instuction memroy, program counter, adder로 구현할 수 있다.

## R-Format instructions

R-format instruction은 산술/논리 명령어fh add, sub, and, or 등을 담당한다고 했다. 이 형식은 모두 2개의 register를 모두 읽고 그 내용을 ALU에 넣어 연산하고 그 결과를 destination register에 쓴다. 즉, two data words read from the register file and one data word written into the register file. 

<center><img src="/images/CO/chap4_R_form.png" width = "700"></center><br>

RegWrite는 write operation을 control하기 위함이다. 읽는건 항상 하는거지만 write는 신호를 받아 clock edge에서 write모드로 다시 바꿔야 하기 때문이다.

## Load and Store Operation


Intstruction은 ```ld x1, offset_value(x2)```과 ```sd x1, offset_value(x2)```의 구조를 가지고 있다. **Store의** 경우에는 data memory에 value를 write하고 **load의** 경우는 data memory에서 read한 값을 register file에 write한다.

<center><img src="/images/CO/chap4_ls.png" width = "700"></center><br>

### Immediate generation unit

Instruction의 binary code를 보면 immediate는 [11:0]으로 12bit이다. 그런데 우리가 쓰는 data는 현재 64bit이다. 그래서 bit를 늘려줘야 하는 것이다. 이것을 **sign-extend**라고 하고 Imm Gen에서 일어나는 일이다. 즉, Imm Gen에서는 32bit 전체를 받아 앞에 필요없는 opcode, func, rd, rs1을 다 제외하고 imm만 남기고 앞에는 sign-extend를 시켜 주는 것이다. 

## Branch implementation

beq의 경우는 two register 값을 받고 equality를 비교한다. 그리고 16-bit의 offset이 branch target address를 찾기 위해 계산된다. 

> <center>Target address = (Sign extended offset << 1) + PC</center>

여기서 예시를 들어보겠다. 
```
beq x1, x2, 1
```
만약 현재 PC가 0x00400000 = 4,194,304₁₀이라고 하자. 그러면 어느 주소로 가야할까? 위의 공식을 이용하면 (1 << 1) = 2니까 4,194,304₁₀ + 2₁₀를 하면 뭐가 이상하지 않은가? 주소는 4비트씩 움직인다고 했는데.... 이건 앞에서 배운 immediate를 저장하는 방법에 힌트가 있다. 애초에 SB format에서는 2의 배수만 가능한 것이다. 그래서 [11:0]이 아닌 [12:1]로 저장된다는 것을 생각하면 된다. 이 예시가 가능해지려면 다음과 같이 돼야한다.
```
beq x1, x2, 2
```
이렇게 된다면 (2<<1) = 4이기 때문에 4,194,304₁₀ + 4₁₀가 답인 것이다. 그래서 SB format이 [12:1] 형태로 저장돼 있다는 것은 halfword로 저장되어 있다고 생각하면 된다. 이게 바로 left shift 1 == $의 \times$2를 해주는 것이다. 이게 헷깔리는 이유는 I-format의 immediate 때문일 것인데, SB format의 branch offset과 I format의 offset은 다른거다. <br>

<center><img src="/images/CO/chap4_branch.png" width = "700"></center><br>

ALU 옆에 zero가 써진 이유는 branch instruction일 때 두 값을 비교하는 방식은 subtract 했을 때 0이냐 아니냐를 보는 것이기 때문이다. 만약 0이면 branch 돼야하니까 To branch control logic으로 나가고 나중에 볼 것이지만 control에서 나오는 branch 신호와 and가 되어 나중에 branch target address를 사용하도록 한다. 

# ◼︎ 단순한 구현(A Simple Implementation Scheme)

제어 기능을 추가하여 구현한 data path를 볼 것이다.

## ALU 제어
<center><img src="/images/CO/chap4_ALU.png" width = "700"></center><br>

ALU의 경우 이 4가지에 control 신호에 의해 어떤 계산을 할 지 결정하게 된다. 
* ld, sd: 메모리 주소 연산을 위해 add사용 - 00(ALUOp)
* R-type: 본인 타입에 맞는 연산 사용 - 10(ALUOp)
* beq: 비교를 위한 sub 사용 그리고 테스트 - 01(ALUOp)

<center><img src="/images/CO/chap4_ALU_control.png" width = "700"></center><br>
funct가 4bit인 이유는 다음 두 표를 보면 알 수 있다.

<center><img src="/images/CO/chap4_ALUOp.png" width = "700"></center><br>
ld, sd, beq의 경우 funct가 필요없다. 그래서 x로 사용한 것이다. 그런데 R-type의 경우 funct가 있어야 어떤 연산을 할 것인지를 구별할 수 있게 된다. 그런데 여기서 보면 funct의 10bit를 모두 다 쓸 필요가 없다는 것이 보인다. 실제 차이를 구별하기 위해서는 오직 20, 14, 14, 12비트만 확인하면 어떤 명령어를 썼는지 알수 있다. 그래서 4bit의 funct가 들어가게 되는 것이다.

## 주 제어 유닛의 설계

<center><img src="/images/CO/chap4_inst_bin.png" width = "700"></center><br>

몇가지 설계의 기초가 되는 것들이 있다. 
* opcode의 field는 항상 6:0이고 opcode에 따라 funct7,funct3를 확장 해야 할 수도 있다.
* R-type과 branch instruction의 첫 register(rs1)은 항상 19:15에 있다. (store/load에서는 base register)
* R-type과 branch instruction의 두 번째 register(rs2)은 항상 24:20에 있다. (store에서는 메모리에 저장될 register)
* Branch나 load/store의 immediate는 12bit이다.
* R-type과 load의 목적지 register(rd)는 항상 11:7이다.

## Six control signals

<center><img src="/images/CO/chap4_6_control.png" width = "700"></center><br>

* RegWrite: 1이면 쓰기, 0이면 읽기
* ALUSrc: 1이면 imm, 0이면 rs2
* PCsrc: 1이면 branch, 0이면 PC+4
* MemRead: 1이면 memory 읽기, 0이면 아무것도 하지 않기
* MemWrite: 1이면 memory에 쓰기, 0이면 아무것도 하지 않기
* MemtoReg: 1이면 memroy에서 읽은 값 출력하기, 0이면 ALU의 계산값 출력하기

PCsrc가 맘에 되게 안든다. 그래서 이걸 AND를 이용해 수정해볼 것이다. 그래서 8 control signal로 만들어 볼 것이다.

<center><img src="/images/CO/chap4_8.png" width = "700"></center><br>
이렇게 PCsrc를 ALUOp와 Branch signal로 나누어주었다.

<center><img src="/images/CO/chap4_control_sig.png" width = "700"></center><br>

## Four steps for R-type

1. Instruction fetch & PC값 증가
2. Register file에서 두 개 register 값 읽기(이 과정에서 control unit 계산)
3. ALU operation
4. ALU 계산 결과를 rd로 쓰기

<center><img src="/images/CO/chap4_8_r.png" width = "700"></center><br>

## Steps for ld

1. Instruction fetch & PC값 증가
2. rs1 읽기
3. rs1안에 있는 값 + sign-extended 12 bit(offset), add
4. ALU에서 나온 결과값 data memory의 주소로 사용
5. memory unit에서 나온 값을 rd로 쓰기

<center><img src="/images/CO/chap4_8_ld.png" width = "700"></center><br>

## Steps for beq

1. Instruction fetch & PC값 증가
2. rs1, rs2 읽기
3. ALU에서 sub하고 sign-extended 12bit를 << 1 해서 branch target address 구함
4. ALU에서 0 나오면 PC + (sign-extended 12bit << 1)

<center><img src="/images/CO/chap4_8_beq.png" width = "700"></center><br>

## Single cycle

<center><img src="/images/CO/chap4_single_cycle.png" width = "700"></center><br>
이렇게만 하면 single cycle을 완벽히 올바르게 작동시킬 수 있다. 하지만 비효율성 때문에 현대에는 이렇게 쓰이고 있지 않다.

<br>
<br>
<b><span style="color:#DB9239">여기까지가 중간 범위</span></b>

---

# ◼︎ Overview of pipelining

여태까지 우리는 한 instruction의 실행이 끝나면 그 다음 instruction을 실행시키는 single cycle 방식으로 하였다. 하지만 이렇게 한 작업이 진행이 끝날때까지 기다리기만 하면 굉장히 비효율적이지 않을까?

<center><img src="/images/CO/chap4_pipe_exp.png" width = "700"></center><br>

이 그림을 보면 집안일은 한다고 할때 모든 일이 끝날때 까지 기다리면 굉장히 오핸시간이 걸리게 된다. 하지만 아래의 그림을 보면 건조기가 돌아갈때 세탁기는 다 쓴거니 또 새로 돌릴수 있다. 약간 멀티태스킹한다는 것처럼 생각을 하면 시간이 굉장히 단축이 된다는 것을 볼 수 있다. 

## Steps in executing RISC-V

위에서 본것처럼 RISC-V가 실행되는 방식에도 step을 5가지로 나눌 수 있다.

1. IF(i$): Fetch instruction, increment PC
2. ID: Instruction, read register
3. EX: memory-ref → address 연산, Arithmetic/logical Ops → 실행 연산
4. MEM(D$): load → 메모리에서 data read, store → 메모리에 data write
5. WB: Write data를 레지스터로

### Example

| Instruction class               | Instruction fetch | Register read | ALU operation | Data access | Register write | Total time |
|----------------------------------|------------------|--------------|--------------|------------|---------------|-----------|
| Load word (lw)                   | 200 ps           | 100 ps       | 200 ps       | 200 ps     | 100 ps        | 800 ps    |
| Store word (sw)                  | 200 ps           | 100 ps       | 200 ps       | 200 ps     | -             | 700 ps    |
| R-format (add, sub, and, or)    | 200 ps           | 100 ps       | 200 ps       | -          | 100 ps        | 600 ps    |
| Branch (beq)                     | 200 ps           | 100 ps       | 200 ps       | -          | -             | 500 ps    |

실제로는 이런식으로 각각 다른 실행시간을 가지게 된다.

<center><img src="/images/CO/chap4_pipe_real.png" width = "700"></center><br>

위의 표를 봤을 때 Total time은 명령어에 따라 달라진다는 것을 알 수 있지만 제일 큰 800ps를 기준으로 사용해야한다. 이렇듯 pipeline에서도 100ps처럼 짧게 걸리는 step이 있어도 최대 시간의 step인 200ps을 사용해야한다. 그래서 lw instruction을 3개를 실행한다고 하면 single cycle이면 2400ps가 걸리지만 pipeline을 사용하면 시간이 획기적으로 줄어서 1400ps만 걸린다는 것을 확인할 수 있다.

> $$\text{Time between instructions}_{\text{pipelined}} = \frac{\text{Time between instructions}_{\text{nonpipelined}}}{\text{Number of pipe stages}}$$

위의 수식은 이상적인 공식이라서 nonpipelined가 위의 single cycle이랑 같은게 아니라 모든 단계의 step당 걸리는 시간이 같아야한다. 이런식으로 되면 $\frac{2400}{1400} \neq \frac{800}{200}$이다. 하지만 이것은 instruction의 숫자가 매우 작아서 그런데 많다고 가정해보자. 1,000,003 instructions를 사용한다고 하면 multi cycle을 이용할 때는 $1,000,000 \times 200ps + 1400ps = 200,001,400ps$이고 single cycle일 때는 $1,000,000 \times 800ps + 2,400ps = 800,002,400ps$이다.

\[
\frac{800,\!002,\!400\ \text{ps}}{200,\!001,\!400\ \text{ps}} \approx \frac{800\ \text{ps}}{200\ \text{ps}} \approx 4.00
\]

그래서 실제로 실행시간 향상은 거의 이상적인 것과 일치하다. 이로 인해 알 수 있는 것은 pipelining은 instruction 숫자가 늘어날 수록 성능이 향상된다. 

# ◼︎ Designing Instruction Sets for Pipelining

다음은 실제 RISC-V에서 구성되는 pipeline의 step(pipeline stage)이다. 
<center><img src="/images/CO/chap4_pipe_risc.png" width = "700"></center><br>

그리고 다음은 laod, add, store, sub, or의 instruction이 순서대로 진행될 때 pipeline의 graphic이다.
<center><img src="/images/CO/chap4_pipe_graph.png" width = "700"></center><br>
Add와 OR을 보면 Reg가 겹친 것 같지만 오른쪽에 색칠된 것은 read이고 왼쪽에 색칠된 것은 write이기 때문에 같은게 아니다. 

## Pipeline Hazard

어떠한 이유로 pipeline에서 바로 다음 clock에 다음 instruction이 나오지 않으면 hazard가 발생했다는 것이고 이는 stall(bubble)로 해결 할 수 있다. 즉, 그냥 instruction을 진행해도 될 때 까지 기다리는 것이고 그 사이 시간을 buuble이라고 하는 것이다.

### Structural hazard (구조적 해저드)

구조적 해저드는 하드웨어적으로 불가능 할 때 발생한다.

<center><img src="/images/CO/chap4_struct_haz_mem.png" width = "700"></center><br>
이것은 동그라미 부분에서 memory를 써야하는데 두 상황 동시에 써야하기 때문에 구조적 해저드가 일어난 상황이다.<br>
이렇게 memory의 구조적 해저드가 일어난 강황에서는 memory를 두개를 사용하면 된다. Instruction memory와 data memory로 분리를 하는 것이다.

<center><img src="/images/CO/chap4_struct_haz_reg.png" width = "700"></center><br>
이것은 동그라미 부분에서 register를 써야하는데 두 상황 동시에 써야하기 때문에 구조적 해저드가 일어난 상황이다.<br>
레지스터의 경우에는 memory와는 조금 다르다. Register는 접근이 굉장히 빠르기 때문에 clock의 half time만으로도 접근이 가능하다. 그렇기 때문에 **first half는 write register**를 **second half에서는 read register**를 사용하게 하면 된다. 그 그림은 방금 위에서 설명한 색이 다른 register를 뜻한다.

### Data hazard (데이터 해저드)

데이터 해저드의 경우는 명령어를 실행하는데 필요한 데이터가 아직 준비되지 않아서 실행할 수 없음에서 생기는 해저드이다. 

```
add x19, x0, x1
sub x2, x19, x3
```
이라는 명령어를 실행한다고 하면 x19 register에 저장되는 계산 값을 sub에서 다시 사용해야 하기 때문에 add가 끝난 후에 instruction을 시작할 수 있지만 이는 pipeline이 아니게 되는 것이다. 이런 경우를 data hazard라고 한다.<br>

이런 data hazard는 **forwarding**과 **bypassing**을 통해 해결할 수 있다. 이 것은 쉽게 생각해 x19에 저장이 됐을 때 값을 가져오는 것이 아닌 ALU 연산이 끝나자 마자 그 값을 바로 가져오는 것이라고 할 수 있다.
<center><img src="/images/CO/chap4_data_haz_forwarding.png" width = "700"></center><br>
이렇게 하면 stall(bubble)이 없이 바로 연산을 빠르게 할 수 있다. 하지만 이 방법은 문제가 되는 부분이 있다. 만약 load 명령어라고 생각을 하면 ALU 다음이 아닌 data memory에서 가져온 값을 사용해야하는데 이는 위의 forwarding에서는 해결할 수 없다. 이런 경우를 **load-use data hazard**라고 하는데 이는 **pipeline stall**이란 방식을 통해 해결할 수 있다.
<center><img src="/images/CO/chap4_data_haz_load.png" width = "700"></center><br>
이렇게 한 clock stall(bubble)을 넣게 되면 문제없이 memory에서 출력된 값을 EX전에 넣을 수 있게 된다.

### Control hazard(Branch hazard, 제어 해저드)

제어 해저드는 분기 해저드라고도 하는데 make a dicision based on the result of instruction일 때 일어나게 된다. 즉, beq와 같은 instruction이 실행 될 때 발생하는 것이다. <br>

제어 해저드의 경우 **pipeline stall(지연)**을 통해 해결할 수 있다. Branch instruction이 있으면 항상 branch 된다고 가정하고 stall을 하는 방식이다.

<center><img src="/images/CO/chap4_control_haz_stall.png" width = "700"></center><br>

이렇게 항상 branch가 된다고 생각하고 register애서 branch되는 주소값을 **2clock stall**을 통해 알게 된다. 그런데 당연히 이러면 만약 branch가 일어나지 않으면 엄청난 손해를 보게 된다. 그래서 대안으로 나온 것이 **branch prediction**이다.<br>
이 방식은 분기를 할지 안할지 예측하는 것이라고 생각하면 된다. 그래서 이 prediction에는 여러가지가 있다. 우선 가장 간단하게는 **untaken**이라는 방식이 있다. 이 방식은 항상 branch가 안된다고 생각하는 것이다. 만약 branch가 안되는게 맞았으면 제일 빠른 속도로 실행하는 것이 되는것이고 branch가 돼야 했으면 손해를 보면서 파이프라인을 다시시작(**flush**)해야 한다. 그렇기 때문에 여기서는 이 flush, 즉 잘못된 instruction을 모두 지우고 분기 대상 주소에서 다시시작할 수 있게 만들어야한다. 

<center><img src="/images/CO/chap4_control_haz_pred.png" width = "700"></center><br>
이렇게 항상 정해져있는 방식을 **static branch prediction**이라고 한다. 이 방식은 굉장히 ridig하고 stereotypical하다. 그렇기 때문에 **dynamic branch prediction**이라는 개념이 나오게 되었다. Dynamic branch prediction은 이전의 결과를 저장하고 있다. 이전의 값이 taken이나 untaken이면 다음 branch도 그 결과를 따라갈 가능성이 굉장히 높다. 이런 방식은 90%정도의 정확도를 가지기 때문에 static 보다 훨신 효율적이다. 그리고 **delayed branch**라는 개념도 있는데 이는 branch 다음 하나의 instruction은 무조건 실행을 하는 것이다. 즉, 분기 결정을 한 cycle뒤에 적용하는 것이다. 이는 MIPS 구조에서 사용되는 방식이다. 

<center><img src="/images/CO/chap4_control_haz_delay.png" width = "700"></center><br>
이는 delayed branch를 나타낸 그림이다. 이렇게 바로 뒤에 add instruction은 무조건 실행한 다음 register에서 각 branch에 맞는 instruction을 실행하게 되는 것이다. MIPS에서는 자동적으로 이 delayed branch slot에 beq와 무관한 instruction을 넣게 된다.

# ◼︎ 파이프라인 데이터패스 및 제어

파이프라인을 만들기 위해서는 각 stage사이에서 현재의 값을 저장하고 있어야 한다. 그래서 추가해준 것이 register이다. 

<center><img src="/images/CO/chap4_pipe_reg.jpeg" width = "700"></center><br>

## ld instruction의 파이프라인

<center><img src="/images/CO/chap4_load_pipe.png" width = "1000"></center><br>

Read일 때는 오른쪽을 write일 때는 왼쪽을 파란색으로 칠해줘서 structural hazard로 부터 벗어날 수 있게한다. 그래서 위의 5가지의 그림을 보면 IF → ID → EX → MEM → WB를 순서대로 pipe라인이 형성돼 load 명령어를 실행하고 있는 것을 확인할 수 있다. 

## store instruction의 파이프라인

Store의 경우 조금 pipeline을 자세하게 봐야한다. 앞 부분은 똑같이 실행되지만 EX부분에서는 차이점이 생기게 된다. store 명령어는 구조가 sd rs2, offset(rs1)꼴이다. 그래서 rd2의 값을 data memory안에 그대로 넣어줘야하고 ALU에는 rs2가 아닌 rs1과 offset이 들어가야 하기 때문에 flow를 자세하게 봐야한다.

<center><img src="/images/CO/chap4_store_ex.png" width = "700"></center><br>
이렇게 store 명령어는 rs2가 alu로 들어가지 않고 ID/EX register에서 EX/MEM register로 옮겨져서 사용이 되게 된다.

<center><img src="/images/CO/chap4_store_pipe.png" width = "1000"></center><br>

그리고 MEM stage를 보면 load랑 달리 write를 해야하기 때문에 data memory의 왼쪽이 색칠된 것을 확인할 수 있다. 그리고 WB stage의 경우 store 명령어에서 사용하지 않는다는 것을 알 수 있다. 그래서 실제로는 WB stage에서는 아무 일도 일어니지 않는다. 그래서 파란색으로 칠해진 부분이 아무것도 없는 것이다.

## Uncover a bug

그런데 위의 pipeline에는 심각한 오류가 하나 있다. Single cycle일 때랑 굉장히 차이나는 부분중 하나이긴 한데 이는 write 부분의 clock을 맞춰줘야함에서 오는 차이점이다. 원래 우리는 write register가 처음 instruction을 받았을 때 rd를 바로 넣어주었다. 하지만 write register의 경우는 WB stage에서 써줘야 한다. 그래서 다음 pipeline과 같이 변경이 필요하다. 

<center><img src="/images/CO/chap4_pipe_corr.png" width = "700"></center><br>

이렇게 따로 빼줘서 모든 register를 거쳐서 다시 돌아오게 해야하는 것이다. 그래서 load instruction에서 사용하는 부분을 모두 색칠한 수정된 파이프라인은 다음과 같다.

<center><img src="/images/CO/chap4_pipe_load.png" width = "700"></center><br>

## Graphically representing pipelines

파이프라인을 그리는 방법에는 크게 두가지로 나눠진다.

1. Muliple-clock-cycle pipeline diagrams
2. Single-clock-cycle diagrams

### Multiple-clock-cycle pipeline

<center><img src="/images/CO/chap4_multi_pipe.png" width = "700"></center><br>

clock들 사이에 중간 register를 끼워서 그 사이단계가 존재한다는 것을 보여주면 된다. 이 방법은 instruction이 달라질때 어떤 stage들이 동시에 일어나고 있는지 알기 쉽ㄴ다. 

### Single-clock-cycle diagram

<center><img src="/images/CO/chap4_single_pipe.png" width = "700"></center><br>

그림에서는 clock cycle이 5일때를 보여주고 있다. 즉, 이 방식은 세로로 잘라서 단면을 보여주는 것과 비슷하다. 그래서 이 경우에는 한 cycle 내에서 어떤 instruction이 실행되고 있는지 보여주는데에 특화돼있다. 

## 퍄이프라인 제어(Pipelined control)

Single cycle에서도 그랬듯 우선 기본적인 흐름을 이해한 후에 실제로 이 것들을 제어하기 위한 mux나 control unit들을 추가시켜줘야 한다. 그래서 그것들을 추가해준 간략한 그림이 다음과 같다. 

<center><img src="/images/CO/chap4_pipe_cont.png" width = "700"></center><br>

원래 single cycle에서는 모든 control signal이 동시에 들어갔다. 그런데 지금 위의 pipeline일 때를 보면 서로 다른 stage에서 들어가야 한다는 것을 보여주고 있다. 

<center><img src="/images/CO/chap4_pipe_control_sig.png" width = "1000"></center><br>

위의 표와 pipline을 비교하면서 보면 EX에서 ALUop, ALUscr이 사용되고 MEM에서는 Branch, MemRead, MemWrite 그리고 WB에서는 RegWrite, MemtoReg가 따로따로 stage에서 사용되는 것을 확인할 수 있다. 그리고 앞의 stage에서 사용했으면 뒤의 stage register에는 저장할 필요가 없기 때문에 오른쪽 그림을 보면 점점 register의 크기가 줄어드는 것을 볼 수 있다. 그래서 최종적으로 나오는 control unit을 포함한 pipeline은 다음과 같다.

<center><img src="/images/CO/chap4_control_unit_pipe.png" width = "800"></center><br>

# ◼︎ Data hazard and forwarding

앞에서 data hazard가 무엇인지 배웠다. 그래서 다음의 instruction set은 data hazard가 일어나는 경우라는 것을 알 수 있을 것이다.

```
sub x2, x1, x3
and x12, x2, x5
or  x13, x6, x2
add x1, x2, x2
sd  x15, 100(x2)
```

이 경우 x2가 계속 연산이 끝나기 전에 사용되어서 data hazard가 일어나고 이 부분을 해결해줘야 한다는 것을 알고 있다. 우선 sub계산에서 나온 x2를 아래에서 사용해야하는 것을 알고 있을 것이다. 그래서 data hazard가 일어나고 있는 상황의 그림은 다음과 같다.

<center><img src="/images/CO/chap4_data_haz_pipe.png" width = "700"></center><br>

위에서 data hazard를 해결하기 위한 방법이 뭐였는지 생각해보자. 일단 쉬운 방법은 stall을 사용하는 것이었다. 그냥 sub의 연산이 끝날 때 까지 stall을 하고 and부터 실행하면 된다. 그런데 이 방식은 clock의 사용에서 굉장히 비효율적인 방법이라고 하였다. 그래서 다른 대안으로 forwarding이 있었다. 굳이 WB stage까지 갈 필요 없이 계산값만 미리 알면 가지고 사용할 수 있다는 것이었다. 위의 그림에서 보면 add와 sd는 WB이 되고 난 이후기 때문에 x2를 그대로 사용해도 상관이 없다. 하지만 문제가 되는 부분은 and와 add부분이고 이는 forwarding을 사용하여 EX에서 값을 미리 가져오면 된다.

<center><img src="/images/CO/chap4_data_haz_pipe_corr.png" width = "700"></center><br>

이렇게 and는 EX/MEM register에서 x2의 값을 가져와 사용하고 or은 MEM/WB register에서 가져와서 forwarding을 사용하고 있다. 

## Data hazard detection

Data hazard를 찾기 위한 조건은 다음과 같다. 

> 1a. EX/MEM.RegisterRd == ID/EX.registerRs1
> 1b. EX/MEM.RegisterRd == ID/EX.registerRs2
> 2a. MEM/WB.RegisterRd == ID/EX.registerRs1
> 2b. MEM/WB.RegisterRd == ID/EX.registerRs2

이것을 참고하여 위의 instruction set에서 sub-and에서의 data hazard의 조건은 1a. EX/MEM.RegisterRd == ID/EX.registerRs1이다. 이런식으로 data hazard의 조건을 이용하여 detect하면 되지만 모든 경우에 가능한 것은 아니다. 왜냐하면 register에 write를 하지않는 경우도 있기 때문이다. x0의 경우는 항상 0으로 write가 금지돼 있다. 그래서 1의 조건 앞에 EX/MEM.RegisterRd != 0과 MEM/WB.RegisterR != 0의 조건을 추가해줘야 한다.

## Forwarding

그래서 이 forwarding을 해야하는 위치는 EX가 되는 것이다. ID/EX에서 이전 clock일때의 EX 결과값을 가져와서 forwarding을 하여 ALU가 실행돼야 한다.

<center><img src="/images/CO/chap4_forwarding.png" width = "700"></center><br>

이렇게 두개의 MUX_A와 MUX_B가 사용되기 때문에 이를 제어해줄 control unit이 필요하고 그 control signal은 다음과 같다.

| **Mux control** | **Source** | **Explanation** |
|-----------------|------------|-----------------|
| ForwardA = 00   | ID/EX      | The first ALU operand comes from the register file. |
| ForwardA = 10   | EX/MEM     | The first ALU operand is forwarded from the prior ALU result. |
| ForwardA = 01   | MEM/WB     | The first ALU operand is forwarded from data memory or an earlier ALU result. |
| ForwardB = 00   | ID/EX      | The second ALU operand comes from the register file. |
| ForwardB = 10   | EX/MEM     | The second ALU operand is forwarded from the prior ALU result. |
| ForwardB = 01   | MEM/WB     | The second ALU operand is forwarded from data memory or an earlier ALU result. |

이 signal을 이용하여 forwarding unit module을 코드로 만들면 다음과 같다.

### EX Hazard(EX/MEM)

``` c
\\ 1a.
if (EX/MEM.RegWrite
and (EX/MEM.RegisterRd ≠ 0)
and (EX/MEM.RegisterRd = ID/EX.RegisterRs1)) ForwardA = 10
\\ 1b.
if (EX/MEM.RegWrite
and (EX/MEM.RegisterRd ≠ 0)
and (EX/MEM.RegisterRd = ID/EX.RegisterRs2)) ForwardB = 10
```

### MEM Hazard(MEM/WB)

``` c
\\ 2a.
if (MEM/WB.RegWrite
and (MEM/WB.RegisterRd ≠ 0)
and (MEM/WB.RegisterRd = ID/EX.RegisterRs1)) ForwardA = 01
\\ 2b.
if (MEM/WB.RegWrite
and (MEM/WB.RegisterRd ≠ 0)
and (MEM/WB.RegisterRd = ID/EX.RegisterRs2)) ForwardB = 01
```

그런데 이 코드는 문제가 있다. 일단 MEM/WB은 EX/MEM보다 나중의 일이기 때문에 항상 EX/MEM보다는 최신값이어야 한다. 

```
add x1, x1, x2
add x1, x1, x3
add x1, x1, x4
```
라고하면 계속 forwarding이 돼야하는데 MEM/WB가 update된 값을 넣어줘야하고 이는 EX/MEM과 값이 다르다. 그래서 수정된 최종 코드는 다음과 같다.

```c
if (MEM/WB.RegWrite
and (MEM/WB.RegisterRd ≠ 0)
and not(EX/MEM.RegWrite and (EX/MEM.RegisterRd ≠ 0) and (EX/MEM.RegisterRd = ID/EX.RegisterRs1))
and (MEM/WB.RegisterRd = ID/EX.RegisterRs1)) ForwardA = 01
if (MEM/WB.RegWrite
and (MEM/WB.RegisterRd ≠ 0)
and not(EX/MEM.RegWrite and (EX/MEM.RegisterRd ≠ 0) and (EX/MEM.RegisterRd = ID/EX.RegisterRs2))
and (MEM/WB.RegisterRd = ID/EX.RegisterRs2)) ForwardB = 01
```

그래서 최종적인 pipeline은 다음과 같다. 

<center><img src="/images/CO/chap4_forward_unit_pipe.png" width = "700"></center><br>

## Immediate 연산까지 포함

<center><img src="/images/CO/chap4_forward_imm.png" width = "700"></center><br>
중간에 ALUsrc로 제어되는 MUX를 추가하여 signed immediate연산을 할 수 있게 된다.

## Data hazards and stalls

앞에서 forward는 모든것을 해결해주지는 못한다고 배웠다. 왜냐하면 일반적으로는 EX의 결과값을 가져와서 다음 cycle에서 사용하면 되지만 load연산의 경우 EX에서 나온 결과값은 주소고 실제 값은 MEM이후에서 알 수 있기 때문에 위에서 했던 방식에 위배된다. 그래서 이 경우는 stall을 통해 지연시켜야한다. 

<center><img src="/images/CO/chap4_load_data_haz.png" width = "700"></center><br>

이렇게 forwarding이 되지 않고 뒤로 가고 있는것을 ld-and사이에서 확인할 수 있다. 이를 해결하기 위해 hazard detection unit에 수정이 더 필요하다. 

```c
if (ID/EX.MemRead and
((ID/EX.RegisterRd = IF/ID.RegisterRs1) or
(ID/EX.RegisterRd = IF/ID.RegisterRs2)))
stall the pipeline
```
이런식으로 MemRead가 1이면 load기 때문에 이럴땐 stall을 한번 하여 nop을 생성해주면 된다. 

<center><img src="/images/CO/chap4_load_stall.png" width = "700"></center><br>

이렇게 모든 것을 포함한 pipeline은 다음과 같다.

<center><img src="/images/CO/chap4_hazard_detect_unit.png" width = "700"></center><br>
