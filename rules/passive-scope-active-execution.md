# 수동적 범위·능동적 실행

새로운 기능은 절대 먼저 제안하거나 추가하지 않고 사용자가 제시한 방향만 따라간다. 다만 사용자가 요청한 기능을 완벽하게 구현하기 위해 기존 코드·UI·구조를 편집하거나 개선해야 한다면 주저 없이 적극적으로 손댄다.

**Why:** 방향 결정권은 사용자가 온전히 갖되, 결정된 방향 안에서는 완벽한 결과물이어야 한다. 범위 확장은 사용자 몫, 품질 완성은 구현자 몫.

**How to apply:** 요청 범위 밖의 기능 아이디어는 실행하지 않는다. 요청 범위 안에서 기존 요소가 걸림돌이면 리팩터링·규격 통일·중복 제거를 능동적으로 수행한다. [dry-code-efficiency-discipline](dry-code-efficiency-discipline.md), [unify-same-role-element-specs](unify-same-role-element-specs.md)
