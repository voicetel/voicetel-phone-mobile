Pod::Spec.new do |s|
  s.name             = 'VoicetelVtCallService'
  s.version          = '1.0.0'
  s.summary          = 'VT Call Service Capacitor plugin'
  s.homepage         = 'https://voicetel.com'
  s.license          = 'MIT'
  s.author           = 'VoiceTel'
  s.source           = { :git => '', :tag => s.version.to_s }
  s.source_files     = 'ios/Plugin/*.{swift,h,m}'
  s.ios.deployment_target = '14.0'
  s.swift_versions   = ['5.0']
  s.dependency 'Capacitor'
end


