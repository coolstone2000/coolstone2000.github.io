# 홈 배너 사용법

## 랜덤 사진

`images/home-banner/` 폴더에 사진을 넣고 배포하세요.
JPG, JPEG, PNG, WebP, GIF, AVIF를 지원하며 대소문자는 상관없습니다.
이 폴더와 하위 폴더의 이미지만 후보에 포함됩니다.
홈을 열거나 새로고침할 때 사진을 랜덤으로 골라 표시합니다.
가로 사진은 한 장, 세로 사진은 PC에서 세로 사진 두 장을 나란히 표시합니다.
다른 세로 사진이 없거나 모바일이면 한 장만 표시합니다. 원본 비율을 유지합니다.
하단의 '다른 사진 보기' 버튼으로 새로고침 없이 바꿀 수 있습니다.
버튼으로 바꿀 때는 현재 첫 사진을 제외하고 선택합니다. 자동 슬라이드는 아닙니다.
제목은 `_data/home_banner.yml`의 `title`에서 변경할 수 있습니다.
폴더가 비어 있으면 배너는 표시되지 않습니다.

`_data/home_banner.yml`에서 `mode: random`으로 설정합니다.

## 고정 공지

`_data/home_banner.yml`을 아래처럼 바꾸고,
`_includes/home-banner-notice.md`에 Markdown으로 공지를 작성하세요.
고정 이미지는 `image`에 경로를 적으면 공지 아래 표시됩니다.

```yaml
mode: notice
image: "/images/notice.jpg"
image_alt: "공지 이미지 설명"
```

글만 표시하려면 `image: ""`로 두고, 이미지만 표시하려면 공지 Markdown을 비우세요.
공지 이미지를 랜덤 후보에 넣고 싶지 않으면 `images/home-banner/` 밖에 저장하세요.
공지 종료 후 `mode: random`으로 되돌리면 됩니다. 사진을 지우거나 주석 처리할 필요가 없습니다.
배너 전체를 감추려면 `mode: hidden`으로 바꾸세요.
변경은 저장하고 배포한 후 실제 블로그에 반영됩니다.
