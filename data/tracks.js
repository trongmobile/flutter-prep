// Các nền tảng (track) có ngân hàng câu hỏi riêng. Rank dùng chung (meta.js),
// còn mô tả rank, chủ đề và ngôn ngữ code mặc định khác nhau theo track.
// idPrefix: tiền tố id câu hỏi (vd. "and-jun-q01"); Flutter giữ id cũ không có tiền tố.
// docs: link tài liệu chính thức của nền tảng, hiển thị trên trang chủ và trang ôn luyện.

export const TRACKS = [
  {
    id: "flutter",
    name: "Flutter",
    idPrefix: "",
    lang: "dart",
    hasRoadmap: true, // lộ trình 35 ngày (data/flutter/roadmap.js)
    tagline: "Dart · Widget · State management · Rendering",
    docs: "https://docs.flutter.dev", // tài liệu chính thức
    ranks: {
      fresher: "Cú pháp Dart, widget cơ bản, layout, setState, điều hướng đơn giản.",
      junior: "Null safety, Future/Stream, lifecycle, Provider, gọi API, lưu trữ local.",
      middle: "3 cây widget, Key, Riverpod/Bloc, Clean Architecture, Isolate, testing.",
      senior: "Rendering, native/FFI, performance, kiến trúc lớn, system design, leadership.",
    },
    topics: {
      dart: "Dart",
      async: "Async & Isolate",
      widget: "Widget & Lifecycle",
      layout: "Layout & Rendering",
      state: "State Management",
      navigation: "Navigation",
      arch: "Kiến trúc & DI",
      data: "Networking & Storage",
      native: "Native & Platform",
      perf: "Performance",
      testing: "Testing & CI/CD",
      security: "Security",
      design: "System Design",
      soft: "Behavioral",
    },
  },
  {
    id: "android",
    name: "Android",
    idPrefix: "and",
    lang: "kotlin",
    tagline: "Kotlin · Java · Coroutines · Jetpack Compose",
    docs: "https://developer.android.com/docs", // tài liệu chính thức
    ranks: {
      fresher: "Cú pháp Kotlin, OOP với Java, Activity/Fragment, Intent, layout cơ bản, RecyclerView.",
      junior: "Null safety, lifecycle, ViewModel, StateFlow/LiveData, Coroutines cơ bản, Retrofit, Room.",
      middle: "Coroutines/Flow nâng cao, Jetpack Compose, MVVM/MVI, Hilt, WorkManager, testing.",
      senior: "Performance, memory leak, Gradle & modularization, JVM/ART, kiến trúc lớn, system design, leadership.",
    },
    topics: {
      kotlin: "Kotlin",
      java: "Java & JVM",
      coroutines: "Coroutines & Flow",
      components: "Activity, Fragment & Lifecycle",
      ui: "Jetpack Compose & View",
      navigation: "Navigation",
      arch: "Kiến trúc & DI",
      data: "Networking & Storage",
      background: "Background & Service",
      build: "Gradle & Build",
      perf: "Performance",
      testing: "Testing & CI/CD",
      security: "Security",
      design: "System Design",
      soft: "Behavioral",
    },
  },
  {
    id: "ios",
    name: "iOS",
    idPrefix: "ios",
    lang: "swift",
    tagline: "Swift · UIKit · SwiftUI · Concurrency",
    docs: "https://developer.apple.com/documentation", // tài liệu chính thức
    ranks: {
      fresher: "Cú pháp Swift, optional, struct và class, UIKit cơ bản, Auto Layout, SwiftUI cơ bản.",
      junior: "ARC & retain cycle, closure, protocol, delegate, GCD, URLSession, Codable, vòng đời app.",
      middle: "async/await, actor, state trong SwiftUI, Combine, MVVM/Coordinator, Core Data/SwiftData, testing.",
      senior: "Swift Concurrency nâng cao, performance & Instruments, modularization, kiến trúc lớn, system design, leadership.",
    },
    topics: {
      swift: "Swift",
      memory: "Memory & ARC",
      concurrency: "Concurrency",
      uikit: "UIKit & Lifecycle",
      swiftui: "SwiftUI",
      navigation: "Navigation",
      arch: "Kiến trúc & DI",
      data: "Networking & Storage",
      platform: "App lifecycle & Platform",
      perf: "Performance",
      testing: "Testing & CI/CD",
      security: "Security",
      design: "System Design",
      soft: "Behavioral",
    },
  },
  {
    id: "react-native",
    name: "React Native",
    idPrefix: "rn",
    lang: "ts",
    tagline: "JavaScript/TypeScript · React Hooks · New Architecture",
    docs: "https://reactnative.dev/docs/getting-started", // tài liệu chính thức
    ranks: {
      fresher: "JavaScript/TypeScript cơ bản, component, props/state, Flexbox, StyleSheet, FlatList.",
      junior: "Hooks, useEffect, React Navigation, gọi API, AsyncStorage, Context, debug.",
      middle: "Redux Toolkit/Zustand, React Query, re-render, Reanimated, native module, testing, Expo.",
      senior: "New Architecture (JSI, Fabric, TurboModules), Hermes, performance, kiến trúc lớn, release & OTA, system design.",
    },
    topics: {
      js: "JavaScript & TypeScript",
      react: "React & Hooks",
      components: "Component & Styling",
      state: "State Management",
      navigation: "Navigation",
      native: "Native & New Architecture",
      data: "Networking & Storage",
      animation: "Animation & Gesture",
      tooling: "Expo, Build & Release",
      perf: "Performance",
      testing: "Testing & CI/CD",
      security: "Security",
      design: "System Design",
      soft: "Behavioral",
    },
  },
];

export const DEFAULT_TRACK = "flutter";

// Ngôn ngữ code được tô màu; câu hỏi chỉ cần trường `lang` khi khác ngôn ngữ mặc định của track.
export const LANGS = ["dart", "kotlin", "java", "swift", "ts", "xml"];

export function getTrack(id) {
  return TRACKS.find((t) => t.id === id) || null;
}

// Suy ra track từ id câu hỏi: "and-jun-q01" -> android, "jun-q01" -> flutter.
export function trackOfId(id) {
  const head = String(id).split("-")[0];
  return TRACKS.find((t) => t.idPrefix && t.idPrefix === head) || getTrack(DEFAULT_TRACK);
}
