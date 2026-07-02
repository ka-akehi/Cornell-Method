local wezterm = require 'wezterm'

local config = wezterm.config_builder()
config.automatically_reload_config = true
config.window_background_opacity = 0.85
config.macos_window_background_blur = 25
config.font = wezterm.font_with_fallback {
  { family = 'Menlo', weight = 'Bold' },
  'JetBrains Mono',
  'Symbols Nerd Font Mono',
}
config.font_size = 13.0
config.line_height = 0.95
config.cell_width = 0.95
config.colors = {
  foreground = '#39ff6a',
  background = '#050807',
  cursor_bg = '#f2f2f2',
  cursor_fg = '#050807',
  cursor_border = '#f2f2f2',
  selection_bg = '#2f5f4f',
  selection_fg = '#eafff1',
  ansi = {
    '#050807',
    '#ff5f7a',
    '#39ff6a',
    '#e6db74',
    '#48d7ff',
    '#ff7ee7',
    '#39dfff',
    '#d7ffd9',
  },
  brights = {
    '#5c6f66',
    '#ff7a90',
    '#68ff8f',
    '#fff27a',
    '#6ee7ff',
    '#ff9ff0',
    '#70f7ff',
    '#ffffff',
  },
}

-- ショートカットキー設定
local act = wezterm.action
config.keys = {
  -- Command+vでクリップボードから貼り付け
  {
    key = 'v',
    mods = 'CMD',
    action = act.PasteFrom 'Clipboard',
  },
  -- Option+左矢印でカーソルを前の単語に移動
  {
    key = "LeftArrow",
    mods = "OPT",
    action = act.SendKey {
      key = "b",
      mods = "META",
    },
  },
  -- Option+右矢印でカーソルを次の単語に移動
  {
    key = "RightArrow",
    mods = "OPT",
    action = act.SendKey {
      key = "f",
      mods = "META",
    },
  },
  -- Command+左矢印でカーソルを行頭に移動
  {
    key = "LeftArrow",
    mods = "CMD",
    action = act.SendKey {
      key = "a",
      mods = "CTRL",
    },
  },
  -- Command+右矢印でカーソルを行末に移動
  {
    key = "RightArrow",
    mods = "CMD",
    action = act.SendKey {
      key = "e",
      mods = "CTRL",
    },
  },
  -- Command+Backspaceで前の単語を削除
  {
    key = "Backspace",
    mods = "CMD",
    action = act.SendKey {
      key = "w",
      mods = "CTRL",
    },
  },
  -- Command+Shift+lで画面とスクロールバックをクリア
  {
    key = 'L',
    mods = 'CMD|SHIFT',
    action = act.ClearScrollback 'ScrollbackAndViewport',
  },
  -- Command+dで上下にペイン分割
  {
    key = 'd',
    mods = 'CMD',
    action = act.SplitVertical { domain = 'CurrentPaneDomain' },
  },
  -- Command+rで左右にペイン分割
  {
    key = 'r',
    mods = 'CMD',
    action = act.SplitHorizontal { domain = 'CurrentPaneDomain' },
  },
  -- Command+qで現在のペインを閉じる
  {
    key = 'q',
    mods = 'CMD',
    action = act.CloseCurrentPane { confirm = true },
  },
  -- Command+h/j/k/lで上下左右のペイン間を移動
  {
    key = 'h',
    mods = 'CMD',
    action = act.ActivatePaneDirection 'Left',
  },
  {
    key = 'j',
    mods = 'CMD',
    action = act.ActivatePaneDirection 'Down',
  },
  {
    key = 'k',
    mods = 'CMD',
    action = act.ActivatePaneDirection 'Up',
  },
  {
    key = 'l',
    mods = 'CMD',
    action = act.ActivatePaneDirection 'Right',
  },
}


return config
