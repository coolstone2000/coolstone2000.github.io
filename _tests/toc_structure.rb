# Run with: bundle exec ruby _tests/toc_structure.rb
require 'jekyll'
require 'rexml/document'
Liquid::Template.register_filter(Jekyll::Filters)
template = Liquid::Template.parse(File.read(File.expand_path('../_includes/toc.html', __dir__)))
fixtures = [[1,2,3,2,1], [1,2,4,2,1,2], [1,3,2,4,1], [2,4,3,2], [1,6,1], [1], []]
fixtures.each do |levels|
  html = levels.each_with_index.map { |level, i| "<h#{level} id=\"h#{i}\">Heading #{i}</h#{level}>" }.join
  html = '<h4>No ID: ignored</h4>' + html if levels.first == 1
  output = template.render!('include' => {'html' => html, 'class' => 'toc__menu', 'skip_no_ids' => true})
  doc = REXML::Document.new("<nav>#{output}</nav>")
  lists = doc.root.get_elements('ul')
  raise "Wrong root count: #{levels}" unless lists.size == (levels.empty? ? 0 : 1)
  raise "Escaped list items: #{levels}" unless doc.root.get_elements('li').empty?
  links = REXML::XPath.match(doc, '//a').map { |a| a.attributes['href'] }
  raise "Missing or reordered links: #{levels}" unless links == levels.each_index.map { |i| "#h#{i}" }
  REXML::XPath.each(doc, '//li') { |li| raise 'Invalid list parent' unless %w[ul ol].include?(li.parent.name) }
end
puts "#{fixtures.size} TOC heading fixtures passed"
