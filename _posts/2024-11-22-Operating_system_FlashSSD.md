---
layout: single
title: Operating sysetem - FlashSSD
categories: Operating_system
tags: OS
toc: true
author_profile: false
---
- - -
저장장치로 유명한 SSD에 대해 다뤄볼 것이다. 지금 기준으로 제일 빠르다는게 하이닉스 p51이라던데....
<center><img src="/images/OS/p51.jpg" width = "700"></center><br>
일단 SSD는 전원이 꺼지더라도 데이터를 유지하기 때문에 HDD대신 쓰인다. 이는 Flash(NAND 기반 Flash)에서 시작되는데 어떤 데이터를 쓸 때 해당 데이터가 속해있는 부분을 모두 지웠다 새로 쓰는 방식이라 성능이 나쁠 수 있다. 그리고 이렇게 썼다 지우면 플래시 메모리를 쓸 수 없게 된다. 
<details><summary>썼다 지운다 널 사랑해~</summary>
<iframe width= "1276" height= "718" src="https://www.youtube.com/embed/fR2epQ2ms80" title="하얗게 밝아온 유리창에 썼다 지운다 널 사랑해 💌 𝙄𝙐 (아이유) - 잊어야 한다는 마음으로 [가사]" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></details>
이 마모되는 특성을 보완한 것이 SSD이다. 

# ◼︎ From Bits to Banks / Planes
<center><img src="/images/OS/ssd_chip.png" width = "700"></center><br>
여기서의 page는 앞에서 page와 다르다. 앞에서 말했듯 쓰고 싶으면 지워야한다. 그렇기 때문에 해당 page를 쓰고 싶으면 block을 지워버려야하는데 이건 되게 비효율적으로 보인다.

# ◼︎ Basic Flash Operations
우선 플래시 칩은 3가지 작업을 지원해야한다.
1. **Read**: 위치와 상관없이 10ms정도의 속도로 빠르게 읽을수 있고 균일한 성능을 가진다
2. **Erase**: 모든 block을 다 지우게 된다. 그래서 cost도 많이들고 몇ms정도가 걸리게 되고 모든 bit를 1로 바꿔버린다
3. **Program**: block이 삭제되면 1중에 일부를 0으로 변경하여 원하는 페이지 내용을 플래시에 쓸 수 있게 된다. 꽤나 cost가 드는 편이고 100ms정도가 걸리게 된다.

<center><img src="/images/OS/ssd_ex.png" width = "700"></center><br>
우선 쓰기 위해서 다 erase해야하고 이미 valid로 써진 곳은 쓰지 못하고 error가 뜨게 된다. 

# ◼︎ From Raw Flash to Flash-Based SSDs

위에서 한건 SSD가 아니라 flash memory의 작동 방법이다. 그래서 우리는 이를 이용해 SSD를 만들어야 한다. SSD에는 장치 작동을 조율하기 위한 제어 로직이 있고 이것을 FTL(Flash Translation Layer)를 통해 요청을 명령어로 변환한다. SSD는 이러한 FTL와 여러 flash memory가 합쳐져있다. 병렬로 합쳐져 있고 flash memory를 사용하기 때문에 write가 오래 걸린다. 그리고 마모가 되기 때문에 **wear leveling**이라는 방법을 이용하는데 이것은 FTL이 균등하게 메모리를 사용하게 하는 방식이다. 

## Direct mapped

FTL은 읽기 및 쓰기 작업을 플래시 작업으로 변환해주는 것이라고 했다. Direct mapped를 이용하면 logical page N에 대한 읽기가 physical page N의 읽기에 직접 매핑되는것이다. 그런데 logical page N에 대한 쓰기는 좀 복잡하다. 지웠다 새로 쓰는 방식때문에 별로다.

## A Log-Structured FTL

그래서 이 방법을 사용한다. 이건 저장 장치와 파일 시스템 모두에게 유용하다. 이 방식은 쓰기 작업을 늘 새로운 공간에 연속적으로 하는 방식이다. 어떤 page를 수정하고 싶으면 해당 페이지가 속한 블록을 지우는 것이 아니라 그냥 빈 공간에 새로운 정보를 쓰는 것이다. 이것을 **logging**이라고 한다. 그래서 쓰인 블록의 순서를 알기 위해 mapping table을 가져야 한다. 일단 invalid에서 쓰기 위해서는 무조건 erase가 필요한건 똑같다. 
<center><img src="/images/OS/ssd_log.png" width = "700"></center><br>

이러면 성능과 안정성이 모두 올라간다. 하지만 장점만 있는 것은 아니다. **Garbage**가 erase를 할 때 생긴하는 것이다. 이는 빈 공간을 너무 많이 차지하게되는 문제가 있다. 그래서 주기적으로 garbage collection이라는 것을 해야 하는데 너무 많이 하면 성능 저하가 일어난다. 그리고 mapping table를 쓰는 cost가 높다.

### Garbage collection

위에서 a1, a2의 값을 c1, c2로 바꾼다면 어떻게 될지를 보면 된다.
<center><img src="/images/OS/ssd_garbage.png" width = "700"></center><br>
우선 pysical address의 page number를 바꿔주고 앞의 block을 다 지우고 다시 b1과 b2를 뒤에 이어줘야한다. 이렇게 굉장히 귀찮고 cost가 높은 일을 해야하게 된다. 

## Mapping Table Size

Garbage를 사용하는 것은 해결했지만 mapping table을 사용해야한다는 문제는 해결하지 못했다. mapping table을 SSD의 크기와 똑같게 둘 수는 없지 않은가? 크기를 효율적으로 쓸 방법이 분명 필요하다.

### Block based mapping

page단위로 포인터를 유지하는 것이 아닌 block단위로 만드는 방법이다. 그런데 이 방법은 별로 좋지 않다. Small write를 실행하게 되면 일이 커지게 된다. 하나만 바꾸고 싶어도 모두를 바꿔서 옆으로 옮겨줘야 한다. 아래 그림이 그걸 보여준다.
<center><img src="/images/OS/ssd_block.png" width = "700"></center><br>

### Hybrid mapping

이건 log 블록에 page를 쓰는 방식을 합쳐서 만든 것이다. 
<center><img src="/images/OS/ssd_log_table1.png" width = "700"></center><br>

이렇게 되면 switch merge라는 것을 하게 된다. Log table을 지워줘서 저장 공간을 더 작게 쓸 수 있다. 근데 이건 block based mapping이랑 크게 다를게 없어보이지 않는가? Hybrid mapping은 일부분만 바꾸는 partial merging일 때 극대화 된다.
<center><img src="/images/OS/ssd_partial.png" width = "700"></center><br>