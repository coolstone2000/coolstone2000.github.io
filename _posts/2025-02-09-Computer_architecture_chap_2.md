---
layout: single
title: "CA - chapter 2 Instructions: Language of the Computer"
categories: Computer_architecture
tags: CA
toc: true
author_profile: false
---
하드웨어가 알아들을수 있는 컴퓨터 언어를 **명령어(instruction)**이라고 한다. 이번 장에서는 RISC-V의 명령어에 대하여 알아볼 것이다. 

# ◼︎ 하드웨어 연산

<center><img src="/images/CO/chap2_assemble.png" width = "700"></center><br>

RISC-V 구조는 x0~x31까지 총 32개의 register를 가지고 있고 각 register안에는 64bit의 data가 들어갈 수 있다. 그리고 메모리에는 $2^{61}$개의 word가 들어갈 수 있다. (Word: 32bit = 4byte, Doubleword: 64bit = 8byte)

# ◼︎ Memory operand(메모리 피연산자)

다들 알고 있듯 레지스터만으로는 저장을 많이 하거나 불러오는 것을 하기 힘들다. 그래서 필요한 것이 메모리이다. 이 메모리 안에는 arrays, structures, dynamic data 등이 있다. 

<center><img src="/images/CO/CPU_mem.png" width = "700"></center><br>

위의 그림은 메모리를 사용하는 구조에 대한 그림이다. 이렇게 memory에 있는 value를 load하여 register안으로 넣고 register에서 나온 결과값을 momory에 store하게 된다. 이 load와 store를 하기 위해선 어느 위치의 memory를 택해야하는지에 대한 정보가 필요한데 이것을 주소(address)라고 한다. 주소는 8bit로 돼있으며 8byte 주소중 하나를 선택하기 때문에 연속적인 워드의 주소는 8씩 차이난다. 즉, 1000다음의 주소는 1008가 된다. 

<center><img src="/images/CO/Endian.png" width = "700"></center><br>

이렇게 4byte안에서 작은 숫자에서 올라오는 방식으로 RISC-V는 최하위 주소를 사용하는 liitle-endian방식을 선택하고 있다.(그리은 8byte이지만 RISC-V는 8byte기준으로 생각하면 된다.) 

나중에 더 자세히 베우긴 하겠지만 불러오는 instruction은 lw(Load doubleword)이고 저장하는 instruction은 sw(Store doubleword)라고한다. 

## Example
``` c
A[12] = h + A[8];
```
이런 코드가 있다고 해보자. 이 코드를 assembly code로 만들면 이렇게 될 것이다. 
```
lw x9, 64(x22)
add x9, x21, x9
sw x9, 96(x22)
```
h의 변수는 이미 x21의 register에 담겨 있었고 A의 base address는 x22에 저장되어 있다고 가정하자. 
<center><img src="/images/CO/chap2_mem.png" width = "700"></center><br>

## 상수 또는 수치 피연산자(Constant or Immediate Operand)

연산을 할때 변수도 많이 넣겠지만 상수를 사용하는 경우도 정말 많다. 위의 방법에 따르면 ```a = a + 4;```라는 코드는 다음과 같이 써야한다.
```
lw x9, AddrConstant4(x3)
add x22, x22, x9
```
그런데 이렇게 두 줄로 쓰면 너무 귀찮고 비효율적이지 않겠는가? 그래서 immediate operand를 사용하는 것이다. 그래서 실제로는 위의 코드가 아닌 아래 코드처럼 간단하게 쓸 수 있다.
``` 
addi x22, x22, 4
``` 

### Constant zero
유용하게 많이 쓰이는 상수 중 하나는 0이다. 그런데 이것은 레지스터에 고정된 값이 있다. RISC-V에서 x0 register는 항상 constant 0값을 가지고 있다. 그래서 x0는 변형이 불가능하다. 이 constant zero는 register의 위치를 옮길 때 자주 사용된다. 
```
add x2, x1, x0
```

# ◼︎ 부호 있는 수와 없는 수(Unsigned numbers & signed numbers)

## Unsigned numbers

> $x = x_{n-1}2^{n-1} + x_{n-2}2^{n-2}+ ...+x_12^1+x_02^0$

범위: 0 to $2^n-1$

## Signed numbers

> $x = -x_{n-1}2^{n-1} + x_{n-2}2^{n-2}+ ...+x_12^1+x_02^0$

범위: $-2^n-1$ to $2^{n-1}-1$

그래서 31bit는 sign bit라고 하고 0이면 positive, 1이면 negative가 된다. <br>
**most negative**: 1000 0000 ... 0000<br>
**most positive**: 0111 1111 ... 1111<br>

부호를 바꾸는 방법은 다음과 같다.
1. 보수로 만들기
2. +1을 더해주기

$\bar{x}+x = 1111...1111_2 = -1$<br>
$\bar{x} + 1 = x$

# ◼︎ 명령어의 컴퓨터 내부 표현

Machine code: 이진수로 된 명령어(컴퓨터가 알아듣는 언어)<br>
RISC-V instuction: 32bit로 이루어지고 그 안에는 opcode, register numbers 등으로 이루어져있다.<br>

## 16진수(Hexadecimal)

| 0 | 0000 | 4 | 0100 | 8 | 1000 | c | 1100 |
|:-:|:----:|:-:|:----:|:-:|:----:|:-:|:----:|
| 1 | 0001 | 5 | 0101 | 9 | 1001 | d | 1101 |
| 2 | 0010 | 6 | 0110 | a | 1010 | e | 1110 |
| 3 | 0011 | 7 | 0111 | b | 1011 | f | 1111 |

## Instruction

### R-format instructions

<center><img src="/images/CO/chap2_inst_r.png" width = "700"></center><br>

- opcode: operation code, 명령어가 실행할 연산의 종류<br>
- rd: destination register number
- funct3: 3bit function code(addtional opcode)
- rs1: first source register number
- rs2: second number register number
- funct7: 7bit function code(additional opcode)

ex) add, sub

예시는 다음과 같다.
<center><img src="/images/CO/chap2_r_exp.jpeg" width = "700"></center><br>
(아랍어 읽듯이 오른쪽에서 왼쪽으로 읽으면 된다....)

### I-format instruction

<center><img src="/images/CO/chap2_inst_i.png" width = "700"></center><br>

- rs: source or base address register number
- immediate: constant operand, or offset added to base address

ex) lw, addi

12-bit immediate는 $-2^{11} \sim 2^{11}-1$의 범위를 가진다. 그리고 load에서 사용될 때는 rd의 base address의 offset을 의미하게 된다. 그래서 $\pm 2^{11} = \pm 2048 \, \mathrm{byte}$ ($\pm 2^8 = \pm 256 \, \mathrm{doubleword}$)의 범위를 가지게 된다. 이걸 보면 왜 32개보다 더 많은 register를 쓰기 힘든지를 알 수 있다. 32보다 커지려면 rs와 rd의 크기를 6으로 하나씩 늘려야하고 그러면 그만큼 immediate 범위가 10으로로 줄어들어야하기 때문이다. 그래서 밸런스를 맞추기 위해서 register 32개가 적절한 것이다.

### S-format instruction

<center><img src="/images/CO/chap2_inst_s.png" width = "700"></center><br>

- **rs1**: base address register number
- **rs2**: source operand register number
- **immediate**: offset added to base address

Store에는 rd가 필요 없기 때문에 추가적인 immediate로 사용하게 된다. rs2의 data를 rs1에 저장하게 된다. 

<center><img src="/images/CO/chap2_inst.png" width = "700"></center><br>
실제 instruction에 대한 binary 표현들의 집합은 위와 같다.

### Example

Assume x10 has the base of the array A and x21 corresponds to h.
```c
A[30] = h + A[30] + 1;
```
어셈블리코드는 다음과 같이 된다.
```
ld x9, 240(x10)
add x9, x21, x9
addi x9, x9, 1
sd x9, 240(x10)
```

Machine code로 바꾸면 이렇게 된다.
<center><img src="/images/CO/chap2_inst_exp.jpeg" width = "700"></center><br>

# ◼︎ 논리 연산 명령어 (Logical Operations)

사칙연산만이 아닌 논리 연산도 필요하다. 그래서 RISC-V에서도 몇개의 operation들이 있다.
<center><img src="/images/CO/chap2_logic_op.png" width = "700"></center><br>

NOT이 없는 이유는 XOR를 이용하여 만들 수 있기 때문이다. <br>

<center><span style="font-size: 130%">$\mathrm{NOT}(x) =  \mathrm{XOR}(x, \mathrm{FFFF \, FFFF \, FFFF \, FFFF_{hex}})$</span></center>

## Shift Operation

<center><img src="/images/CO/chap2_shift.png" width = "700"></center><br>

- **Shift left logical**: sll → shift left and fill with 0, slli → i'th shift = multiple by $2^i$
- **Shift right logical**: sll → shift right and fill with 0, srli → i'th shift = divide by $2^i$
- **srai**: 부호를 남겨두고 shift right
<center><img src="/images/CO/chap2_srai.png" width = "400"></center><br>

## And Operation
<center><img src="/images/CO/chap2_and.jpeg" width = "700"></center><br>

mask 역할을 한다. 1 부분은 select할 수 있고 0인 부분은 가릴 수 있다.

## Or Operation

<center><img src="/images/CO/chap2_or.jpeg" width = "700"></center><br>

바꼈으면 좋겠는 bit를 억지로 조절할 수 있다.

## XOR Operation

<center><img src="/images/CO/chap2_xor.jpeg" width = "700"></center><br>

# ◼︎ 판단을 위한 명령어 (Making Decisions: Conditional Branch)

코딩을 배울때 맨 처음 연산들을 알고 나서 다음 하는 것은 조건문일 것이다. 그래서 이제 if(go to)문에 대하여 알아볼 것이다. 

- **beq rs1, rs2, L1**: branch if equal, rs1과 rs2가 같으면 L1으로 가라는 뜻
- **bne rs1, rs2, L1**: branch if not equal, rs1과 rs2가 다르면 L1으로 가라는 뜻

## Example

```c
if (i == j) f = g + h;
else f = g- h;
```
f: x19, g: x20, h: x21, i: x22, j: x23이다. 
<center><img src="/images/CO/chap2_branch_exp.png" width = "700"></center><br>

이걸 assembly code로 바꾸면 다음과 같이 된다.
```
bne x22, x23, Else
add x19, x20, x21
beq x0, x0, Exit
Else:
sub x19, x20, x21
Exit:
```

## 순환문 (While loop)

조건문 다음에는 반복문이 있을 것이다. 반복문 while은 다음과 같이 사용한다.

```c
While (save[i] = k)
    i += 1;
```
i: x22, k: x24, base save in x25

```
Loop :  sll  x100, x22, 3 // Temp reg x10 = i * 8(주소 옮기기)
        add  x10, x10, x25 // address + offset
        ld   x9, 0(x10) // x10 = address of save[i]
        bne  x9, x24, Exit // Exit if save[i] is not k
        addi x22, x22, 1 // i += 1
        beq x0, x0, Loop // go to Loop
Exit:
```

### Basic block 

- A sequence of instructions without branches(except end)
- A sequence of instructions without branch targets of branch label(except beginning)

한번 수행되면 분기 점 없이 끝까지 수행한다. 다른곳으로 나가거나 들어가지도 않는다는 뜻이다.

## Additional instructions

- blt(Branch if less) rs1, rs2, L1: rs1 < rs2이면 L1으로 branch
- bge(Branch if greater or equal) rs1, rs2, L1: rs1 $\geq$ rs2이면 L1으로 branch
- bltu(branch if less than for unsigned) rs1, rs2, L1: rs1 < rs2이면 L1으로 branch(부호 O)
- bgeu(Branch if greater or equal for unsigned) rs1, rs2, L1: rs1 $\geq$ rs2이면 L1으로 branch(부호 O)

### $>$와 $\leq$가 없는 이유

왜 없나 싶겠지만 rs1과 rs2의 위치를 바꾸면 당연하게 사용할 필요가 없다.

# ◼︎ 하드웨드의 프로시저 지원(Supporting Procedures in Computer Hardware)

프로시저(procedure)는 코딩에서 함수라고 생각하면 된다. 여러번 자주 사용되거나 그런것이 필요할때는 function을 정의해서 쉽게 코드를 만드는 것과 같다. 이렇게 procedure를 만드는 방법은 6가지의 step이 있다.

## Six step

1. Put parameters in a place where the procedure can aceess them(x10-x17 레지스터 사용)
2. Transfer control to the procedure(jal x1, Procedure address 명령어 사용)
3. Acquire the storage resources needed for the procedure
4. Perform the desired task
5. Put the result value in a place where the calling program can access it(x10-x17 레지스터 사용)
6. Return control to the point or origin, since a procedure can be called from several pointers in a program (jalr x0, 0(x1))

Procedure를 사용하기 위해 메모리보다 빠른 레지스터를 이용하게 된다. 그런데 RISC-V 소프트웨어에서 사용하는 레지스터 할당 관례가 있다. 
- x10-x17: eight parameter registers in which to pass parmeters or return values (결과값)
- x1: one return address register to return to the point of origin (복귀 주소 값)

## Two Unconditional Jump Instruction

- jal x1, ProcedureAddress(Jumap and link instruction): ProcedureAddress로 가고 원래 주소를 x1에 저장하기
- jalr x0, 0(x1)(Jemp and link register): 원래 주소로 복귀

x10-x17에 값을 넣는 것을 **caller**, 그리고 jal x1, X는 **callee**이다. x1애 저장되는 값은 Return address라고 하고 PC(Program Counter)는 현재 실행중인 프로그램의 주소를 뜻한다.

# ◼︎ 긴 수치와 주소를 위한 RISC-V의 주소지정 방식 (RISC-V Addressing for wide immediates and address)

RISC-V에서는 명령어의 길이를 32비트로 고정한 덕분에 하드웨어가 간단해졌지만 32비트 이상의 상수나 주소를 표시할 수 없다는 문제가 있었다. 이것을 해결하기 위한 해법을 제시할 것이다.

## 큰 수치 피연산자 (Wide Immediate Operand

- **lui**(Load upper immediate, U type): 12부터 31까지에 20비트 상수값을 넣는 명령어이다. 즉, opcode-7bit, rd-5bit를 제외한 모든 20bit를 immediate를 사용한다. 그래서 20bit를 immediate를 상위 20비트에 저장하고 하위 12비트는 0으로 채우는 명령어인 것이다.

> $0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0011 \, 1101 \, 0000\, \vert \, 0101 \, 0000 \, 0000_2$

를 사용해보겠다.

```
lui  x19. 976 // 976 = 0000 ... 0000 0000 0011 1101 0000
addi x19, x19, 1280 // 1280 = 0000 0101 0000
```
첫줄을 실행하면, 
> $0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0011 \, 1101 \, 0000\, \vert \, 0000 \, 0000 \, 0000_2$

이 된다. <br>
두번째 줄을 실행하면
> $0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0000 \, 0011 \, 1101 \, 0000\, \vert \, 0101 \, 0000 \, 0000_2$

우리가 원하는 값을 얻을 수 있게 된다. 

## 분기 명령에서의 주소지정 (Addressing in Branches)

Branch instruction들은 모두 SB-format이라고 한다. 이 SB-format은 항상 짝수로만 이동이 가능하다.
<center><img src="/images/CO/chap2_inst_sb.png" width = "700"></center><br>

imm를 보면 1~12인 것을 볼수 있는데 이것은 imm의 0번째 자리는 항상 0으로 취급하고 앞의 sign bit를 붙여줘서 -4096~4094의 범위(짝수만)를 가진다. 이 이유는 한 명령어가 저장된 최소 공간은 4byte로 설정하려 해서 항상 주소 비트의 끝자리가 00으로 끝나기 때문에 끝의 두자리는 안써도 되기 때문에 0번째 자리가 필요 없는 것이다. 사실 1번째 자리까지 필요 없지만 개발당시 2byte 명령어도 만드려는 계획이 있었기 때문에 한자리만 없앤 것이다. 만약 처음부터 만들 계획이 없었으면 imm[13:2]였을 것이다.

UJ-type format도 비슷하다. 
<center><img src="/images/CO/chap2_inst_uj.png" width = "700"></center><br>

이것도 앞에 0의 자리가 없어서 2의 배수이다. 그런데 이렇게 되면 어떤 프로그램도 $2^{20}$보다는 클 수 없다. 이 문제를 해결하는 방법은 relative하게 주소를 결정하는 것이다. 

### PC Relative Addressing

> <center><b>PC = register(레지스터 안의 값 = 주소값) + offset(상수값)</b></center>

이렇게 되면 **branch**일때는 현재 주소에서 $\pm 2^{10}$word이내로, **jump**일 때는 현재 주소에서 $\pm 2^{18}$word이내로 이동할 수 있게 된다.<br>

이 그림은 RISC-V의 네가지 주소 지정 방식을 나타낸 것이다.
<center><img src="/images/CO/chap2_addr.png" width = "700"></center><br>

# ◼︎ 명령어 형식 요약

<center><img src="/images/CO/chap2_type_1.png" width = "700"></center><br>
<center><img src="/images/CO/chap2_type_2.png" width = "1000"></center><br>