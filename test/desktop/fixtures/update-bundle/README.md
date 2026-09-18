# Desktop update bundle fixtures

No production `.app` artifact is stored here. Rust unit tests create a small
synthetic bundle, XML or binary `Info.plist`, and bounded Mach-O headers inside
a disposable temporary directory, then remove it after each test.
