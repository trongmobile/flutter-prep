// Các nền tảng (track) có ngân hàng câu hỏi riêng. Rank dùng chung (meta.js),
// còn mô tả rank, chủ đề và ngôn ngữ code mặc định khác nhau theo track.
// idPrefix: tiền tố id câu hỏi (vd. "and-jun-q01"); Flutter giữ id cũ không có tiền tố.
// docs: link tài liệu chính thức của nền tảng, hiển thị trên trang chủ và trang ôn luyện.

// Từ khoá nhận diện chủ đề trong mô tả công việc (JD) cho tính năng phỏng vấn thử theo JD (js/jd.js).
// Không phân biệt hoa thường và dấu tiếng Việt; khớp theo từ nguyên vẹn. COMMON_KEYWORDS dùng cho mọi track,
// mỗi track bổ sung từ khoá riêng qua keywords({ topic: [...] }). Chủ đề track không có (vd. arch của React Native) bị bỏ qua khi nhận diện.
// Key riêng của track phải là topic của track (scripts/validate.mjs kiểm tra).
export const COMMON_KEYWORDS = {
  arch: ["clean architecture", "mvvm", "mvi", "mvc", "mvp", "dependency injection", "modularization", "architecture", "solid", "design pattern", "kiến trúc", "monorepo"],
  data: ["rest", "restful", "api", "graphql", "websocket", "json", "networking", "offline", "firebase", "sqlite"],
  perf: ["performance", "optimize", "optimized", "optimizing", "optimise", "optimised", "optimising", "optimization", "profiling", "memory leak", "fps", "startup time", "hiệu năng", "tối ưu"],
  testing: ["unit test", "testing", "tdd", "e2e", "ci/cd", "cicd", "continuous integration", "continuous delivery", "continuous deployment", "github actions", "fastlane", "bitrise", "jenkins", "kiểm thử"],
  security: ["security", "bảo mật", "encryption", "mã hóa", "biometric", "ssl pinning", "certificate pinning", "obfuscation", "oauth", "jwt", "owasp", "secure storage"],
  design: ["system design", "thiết kế hệ thống", "scalable", "scalability", "offline-first", "offline first", "architecture design"],
  soft: ["leadership", "tech lead", "team lead", "lead a team", "leading a team", "mentor", "mentoring", "code review", "agile", "scrum", "communication", "teamwork", "soft skill", "kỹ năng mềm", "giao tiếp", "làm việc nhóm", "dẫn dắt"],
};
const keywords = (extra) =>
  Object.fromEntries(
    [...new Set([...Object.keys(COMMON_KEYWORDS), ...Object.keys(extra)])].map((topic) => [topic, [...(COMMON_KEYWORDS[topic] || []), ...(extra[topic] || [])]]),
  );

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
    keywords: keywords({
      dart: ["dart", "null safety", "sealed class", "extension type", "generics"],
      async: ["async", "await", "future", "stream", "isolate", "concurrency", "rxdart", "bất đồng bộ"],
      widget: ["widget", "animation", "stateful", "stateless", "inheritedwidget", "material design", "cupertino", "accessibility", "custom widget"],
      layout: ["layout", "rendering", "custompaint", "renderobject", "sliver", "responsive", "adaptive", "pixel perfect", "pixel-perfect", "impeller", "skia"],
      state: ["state management", "riverpod", "bloc", "cubit", "provider", "getx", "mobx", "redux", "quản lý state", "quản lý trạng thái"],
      navigation: ["navigation", "go_router", "gorouter", "auto_route", "deep link", "deeplink", "routing", "navigator"],
      arch: ["get_it", "injectable", "melos"],
      data: ["dio", "http", "drift", "hive", "isar", "sharedpreferences", "shared preferences", "local storage", "firestore", "grpc"],
      native: ["native", "platform channel", "method channel", "ffi", "kotlin", "swift", "objective-c", "plugin", "push notification", "fcm", "apns", "add-to-app", "platform view", "bluetooth", "ble", "nfc"],
      perf: ["jank", "devtools", "app size"],
      testing: ["widget test", "integration test", "codemagic", "gitlab ci", "automation test", "mocktail", "mockito"],
      security: ["keychain", "keystore"],
    }),
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
    keywords: keywords({
      kotlin: ["kotlin", "kotlin multiplatform", "kmp", "extension function", "sealed class", "null safety"],
      java: ["java", "jvm", "jdk", "multithreading", "concurrency", "garbage collection", "memory model"],
      coroutines: ["coroutine", "coroutines", "kotlin flow", "stateflow", "sharedflow", "rxjava", "rxkotlin", "suspend"],
      components: ["activity", "fragment", "lifecycle", "viewmodel", "broadcast receiver", "content provider", "intent", "process death", "androidx"],
      ui: ["jetpack compose", "compose", "xml layout", "recyclerview", "view system", "material design", "material 3", "constraintlayout", "custom view", "motionlayout"],
      navigation: ["navigation component", "navigation", "deep link", "deeplink", "app link", "navhost", "navcontroller"],
      arch: ["hilt", "dagger", "koin", "multi-module", "usecase", "repository pattern"],
      data: ["retrofit", "okhttp", "room", "datastore", "sharedpreferences", "paging", "moshi", "gson"],
      background: ["workmanager", "work manager", "foreground service", "background", "alarmmanager", "jobscheduler", "push notification", "fcm", "doze"],
      build: ["gradle", "proguard", "r8", "build variant", "flavor", "flavors", "baseline profile", "version catalog", "build time"],
      perf: ["leakcanary", "anr", "jank", "startup", "macrobenchmark", "systrace", "perfetto", "android profiler"],
      testing: ["espresso", "ui test", "junit", "mockk", "mockito", "robolectric", "compose test"],
      security: ["keystore", "proguard", "play integrity", "safetynet"],
    }),
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
    keywords: keywords({
      swift: ["swift", "protocol-oriented", "generics", "property wrapper", "result builder", "swift package manager", "spm", "objective-c", "objc"],
      memory: ["arc", "memory management", "retain cycle", "unowned", "memory graph"],
      concurrency: ["concurrency", "gcd", "grand central dispatch", "async/await", "async await", "actor", "combine", "operationqueue", "structured concurrency", "sendable", "swift 6", "rxswift", "multithreading"],
      uikit: ["uikit", "auto layout", "autolayout", "storyboard", "xib", "uitableview", "uicollectionview", "view controller", "viewcontroller", "programmatic ui", "snapkit"],
      swiftui: ["swiftui", "observable", "observableobject", "navigationstack", "declarative ui"],
      navigation: ["navigation", "navigationstack", "coordinator", "deep link", "deeplink", "universal link", "universal links", "routing"],
      arch: ["viper", "tca", "composable architecture", "coordinator", "swift package", "redux"],
      data: ["core data", "coredata", "swiftdata", "realm", "userdefaults", "urlsession", "alamofire", "codable", "cloudkit"],
      platform: ["app lifecycle", "background task", "widgetkit", "widget", "app extension", "push notification", "apns", "app clip", "healthkit", "storekit", "in-app purchase", "iap", "app store", "testflight", "entitlements", "localization", "siri"],
      perf: ["time profiler", "launch time", "hang", "metrickit", "instruments"],
      testing: ["xctest", "xcuitest", "ui test", "swift testing", "snapshot test", "xcode cloud", "mock"],
      security: ["keychain", "face id", "touch id", "app attest", "jailbreak"],
    }),
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
    keywords: keywords({
      js: ["javascript", "typescript", "es6", "es2015", "nodejs", "node.js", "promise"],
      react: ["react hooks", "hooks", "useeffect", "usestate", "usememo", "usecallback", "context api", "jsx", "tsx", "react compiler", "reactjs", "react.js", "concurrent rendering", "react 18", "react 19", "functional component", "virtual dom"],
      components: ["flatlist", "flashlist", "stylesheet", "flexbox", "styled-components", "nativewind", "tailwind", "component", "components", "props", "scrollview"],
      state: ["redux", "redux toolkit", "zustand", "mobx", "recoil", "jotai", "xstate", "state management", "quản lý state"],
      navigation: ["react navigation", "expo router", "navigation", "deep link", "deeplink", "universal link", "routing"],
      native: ["native module", "native modules", "turbomodule", "turbomodules", "turbo module", "fabric", "jsi", "new architecture", "bridge", "bridgeless", "codegen", "expo modules", "brownfield", "kotlin", "swift", "objective-c", "push notification", "fcm", "apns", "bluetooth", "ble"],
      data: ["axios", "fetch", "apollo", "react query", "tanstack query", "rtk query", "swr", "asyncstorage", "async storage", "mmkv", "watermelondb", "realm"],
      animation: ["animation", "reanimated", "gesture handler", "gesture", "lottie", "skia", "moti", "60fps"],
      tooling: ["expo", "eas", "metro", "codepush", "ota", "over-the-air", "app store", "google play", "gradle", "xcode", "nx", "turborepo", "bundler"],
      perf: ["hermes", "bundle size", "flipper", "re-render", "rerender"],
      testing: ["jest", "react native testing library", "testing library", "detox", "maestro", "appium", "storybook"],
      security: ["keychain", "keystore", "jailbreak", "root detection", "secure storage"],
      design: ["super app", "microfrontend", "micro-frontend", "white label"],
    }),
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
