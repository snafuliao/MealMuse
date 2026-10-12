#!/usr/bin/env bash
# 运行 MealMuseKit 的 Swift 测试。
# 只装了 Command Line Tools（没有完整 Xcode）时，SwiftPM 找不到 Testing.framework，需要显式补上搜索路径。
set -euo pipefail

package_path="$(cd "$(dirname "$0")/../apps/ios/MealMuseKit" && pwd)"
developer_dir="$(xcode-select -p)"
extra=()

if [[ "$developer_dir" == *CommandLineTools* ]]; then
  frameworks="$developer_dir/Library/Developer/Frameworks"
  libs="$developer_dir/Library/Developer/usr/lib"
  extra=(-Xswiftc -F -Xswiftc "$frameworks"
    -Xlinker -F -Xlinker "$frameworks"
    -Xlinker -rpath -Xlinker "$frameworks"
    -Xlinker -rpath -Xlinker "$libs")
fi

# macOS 自带 bash 3.2：空数组在 set -u 下直接展开会报错，需用 ${arr[@]+...} 形式。
exec swift test --package-path "$package_path" ${extra[@]+"${extra[@]}"} "$@"
