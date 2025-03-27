---
layout: single
title: "제목"
categories: 카테고리
tags: 태그
toc: false
author_profile: false
sidebar:
    nav: "docs"
---

위는 그냥 처음 써두는 문법

# 1. 헤더

"#"은 소제목 - "#"개수가 늘어날 수록 점점 크기가 작아짐 (6개 까지)

# 2. 블록

">" 쓰면 아래로 블럭 하나하나 써짐

# 3. 목록

"1., 2., 3." 순서대로
"*" 는 동그라미, "-" 는 빈 동그라미, "+"는 채운 네모

# 4. 코드

"<pre>
<code>
{code}
</code>
</pre>"

를 사용하거나 

"```여기에 어떤 언어인지 쓰고
{code}
```"

# 5. 수평선

"---" 하면 된다

# 6. 링크

"사용문법: [Title](link)
적용예: [Google](https://google.com, "google link")"
를 쓰거나
"<>"를 쓰면 된다

# 7. 강조

"*single asterisks*
_single underscores_
**double asterisks**
__double underscores__
~~cancelline~~"

# 8. 이미지 

"<center><img src="/images/기본형_심볼-01.jpg" width="300" height="300"></center>"
"<img src="/path/to/img.jpg" width="450px" height="300px" title="px(픽셀) 크기 설정" alt="RubberDuck"></img><br/>
<img src="/path/to/img.jpg" width="40%" height="30%" title="px(픽셀) 크기 설정" alt="RubberDuck"></img>"
이런 식으로 사용

# 9. 주석

<--! --> 혹은 [//]: # 를 치면 주석이 달린다

# local server 열기
1. control + `
2. cd coolstone2000.github.io
3. bundle install
4. bundle exec jekyll serve --trace

순서대로 입력

Server address: http://127.0.0.1:4000

Command	Shortcut	Functionality
Jekyll Run	(ctrl+F5)	Builds Project, Starts Jekyll Server & Opens the local hosted site in Browser
Jekyll Stop	(ctrl+F6)	Stops Jekyll Server
Jekyll Restart	(ctrl+F7)	Restarts Jekyll Server
Jekyll Build	(ctrl+F8)	Builds Project
Jekyll Open in Browser	(ctrl+F9)	Opens the local hosted site in Browser while Jekyll Server is running

