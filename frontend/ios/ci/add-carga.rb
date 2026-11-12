# CARGA: puts CARGA's own Swift files into the App target of App.xcodeproj (the project lists each
# file it compiles). Run before add-widgets.rb, which compiles RunActivity.swift into the widget
# extension too, by the reference this adds. Running it again changes nothing.
#
#   ruby frontend/ios/ci/add-carga.rb
require 'xcodeproj'

FILES = %w[CargaVoice.swift RunActivity.swift RunTrackerPlugin.swift].freeze

dir = File.expand_path('../App', __dir__)
proj = Xcodeproj::Project.open(File.join(dir, 'App.xcodeproj'))
app = proj.targets.find { |t| t.name == 'App' }
abort 'no App target' unless app
group = proj.main_group.children.find { |g| g.respond_to?(:path) && g.path == 'App' }
abort 'no App group' unless group

added = []
FILES.each do |f|
  abort "App/#{f} is missing" unless File.exist?(File.join(dir, 'App', f))
  next if group.files.any? { |r| r.path == f }
  ref = group.new_file(f)
  app.add_file_references([ref])
  added << f
end
proj.save
puts added.empty? ? 'CARGA files already in the project' : "added: #{added.join(', ')}"
