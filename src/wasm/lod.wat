(module
  (memory (export "memory") 1)

  ;; 返回值约定：
  ;; 0 = High  高细节，保留边线和阴影
  ;; 1 = Mid   中细节，保留边线，减少渲染开销
  ;; 2 = Low   低细节，隐藏边线和阴影
  (func $selectLod (export "selectLod") (param $distance f32) (param $partCount i32) (result i32)
    ;; 大量零件且相机较远时直接进入低细节。
    (if (result i32)
      (i32.and
        (i32.gt_s (local.get $partCount) (i32.const 18))
        (f32.gt (local.get $distance) (f32.const 8))
      )
      (then (i32.const 2))
      (else
        (if (result i32)
          (f32.lt (local.get $distance) (f32.const 7))
          (then (i32.const 0))
          (else
            (if (result i32)
              (f32.lt (local.get $distance) (f32.const 11))
              (then (i32.const 1))
              (else (i32.const 2))
            )
          )
        )
      )
    )
  )

  ;; 对零件数组做一次面向渲染的 LOD 布局处理。
  ;;
  ;; 输入内存布局与 WebSocket 二进制数据一致：
  ;; 每个零件 9 个 f32，共 36 字节。
  ;; position(x,y,z), scale(x,y,z), color(r,g,b)
  ;;
  ;; lod 越低，零件分布越疏、缩放越小，便于 Three.js 减少视觉拥挤和渲染压力。
  (func $layoutParts (export "layoutParts") (param $ptr i32) (param $count i32) (param $lod i32)
    (local $i i32)
    (local $base i32)
    (local $spread f32)
    (local $scaleFactor f32)

    (local.set $spread
      (if (result f32)
        (i32.eq (local.get $lod) (i32.const 0))
        (then (f32.const 1.0))
        (else
          (if (result f32)
            (i32.eq (local.get $lod) (i32.const 1))
            (then (f32.const 1.15))
            (else (f32.const 1.35))
          )
        )
      )
    )

    (local.set $scaleFactor
      (if (result f32)
        (i32.eq (local.get $lod) (i32.const 0))
        (then (f32.const 1.0))
        (else
          (if (result f32)
            (i32.eq (local.get $lod) (i32.const 1))
            (then (f32.const 0.9))
            (else (f32.const 0.72))
          )
        )
      )
    )

    (local.set $i (i32.const 0))
    (loop $loop
      (if (i32.lt_s (local.get $i) (local.get $count))
        (then
          (local.set $base
            (i32.add
              (local.get $ptr)
              (i32.mul (local.get $i) (i32.const 36))
            )
          )

          ;; position.x *= spread
          (f32.store
            (local.get $base)
            (f32.mul
              (f32.load (local.get $base))
              (local.get $spread)
            )
          )

          ;; position.z *= spread
          (f32.store
            (i32.add (local.get $base) (i32.const 8))
            (f32.mul
              (f32.load (i32.add (local.get $base) (i32.const 8)))
              (local.get $spread)
            )
          )

          ;; scale.x *= scaleFactor
          (f32.store
            (i32.add (local.get $base) (i32.const 12))
            (f32.mul
              (f32.load (i32.add (local.get $base) (i32.const 12)))
              (local.get $scaleFactor)
            )
          )

          ;; scale.y *= scaleFactor
          (f32.store
            (i32.add (local.get $base) (i32.const 16))
            (f32.mul
              (f32.load (i32.add (local.get $base) (i32.const 16)))
              (local.get $scaleFactor)
            )
          )

          ;; scale.z *= scaleFactor
          (f32.store
            (i32.add (local.get $base) (i32.const 20))
            (f32.mul
              (f32.load (i32.add (local.get $base) (i32.const 20)))
              (local.get $scaleFactor)
            )
          )

          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $loop)
        )
      )
    )
  )
)
