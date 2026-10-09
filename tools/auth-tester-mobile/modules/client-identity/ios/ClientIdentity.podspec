Pod::Spec.new do |s|
  s.name           = 'ClientIdentity'
  s.version        = '1.0.0'
  s.summary        = 'Presenting a client certificate from requests the app makes itself'
  s.description    = 'React Native cannot present a client certificate: the identity has to reach a URLSession delegate. This module holds one in memory and makes requests with it (Olympus ADR 0018).'
  s.author         = { 'Neil Fritz' => 'ncfritz@ncfritz.net' }
  s.homepage       = 'https://github.com/ncfritz/olympus'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: 'https://github.com/ncfritz/olympus.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
