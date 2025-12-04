'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const journals = [
      {
        title: "Spring/Summer 2024 Fashion Trends: What's Hot This Season",
        content: `The Spring/Summer 2024 fashion season brings an exciting mix of bold colors, sustainable materials, and nostalgic influences. Designers are embracing vibrant hues, from electric blues to sunny yellows, while also focusing on eco-friendly fabrics that make a statement both visually and ethically.

Oversized blazers continue to dominate, offering versatility and sophistication to any wardrobe. Pair them with tailored shorts for a modern business casual look, or throw them over a simple dress for evening elegance. The power suit is back, but with softer silhouettes and more playful color palettes.

Accessories are taking center stage this season, with chunky jewelry, oversized sunglasses, and statement bags making waves. The mini bag trend continues, but practical crossbody options are gaining popularity for their functionality without sacrificing style.

Sustainable fashion is no longer just a trend—it's becoming the norm. From recycled materials to locally produced pieces, consumers are more conscious than ever about their fashion choices. Vintage and second-hand shopping has seen a significant increase, as fashion lovers seek unique pieces with history.

Footwear trends are equally exciting, with platform sandals, chunky sneakers, and elegant mules leading the way. Comfort meets style as designers focus on creating shoes that look good and feel great all day long.

As we embrace the warmer months, remember that fashion is about self-expression. Mix and match these trends with your personal style to create looks that are uniquely you. After all, confidence is the best accessory you can wear!`,
        excerpt:
          "Discover the hottest fashion trends for Spring/Summer 2024, from vibrant colors and sustainable materials to oversized blazers and statement accessories.",
        tags: JSON.stringify([
          "fashion",
          "trends",
          "spring-summer",
          "sustainable",
          "style",
        ]),
        category: "Fashion Trends",
        view_count: 1250,
        featured_images: JSON.stringify([
          "fashion-trends-2024-1.jpg",
          "spring-summer-styles.jpg",
          "sustainable-fashion.jpg",
        ]),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: "Building a Capsule Wardrobe: Minimalism Meets Style",
        content: `Creating a capsule wardrobe is one of the smartest fashion decisions you can make. It's about curating a collection of versatile, high-quality pieces that work together seamlessly, reducing decision fatigue while maximizing style.

Start with the basics: a well-fitting white t-shirt, classic denim, a little black dress, and a tailored blazer. These foundational pieces form the backbone of your wardrobe and can be dressed up or down depending on the occasion.

When selecting pieces for your capsule wardrobe, focus on quality over quantity. Invest in well-made items that will last for years rather than fast fashion pieces that lose their shape after a few washes. Natural fibers like cotton, silk, and wool not only feel better but also tend to have more longevity.

Color coordination is key to a successful capsule wardrobe. Choose a color palette of 3-5 neutral colors that complement each other, then add 2-3 accent colors for visual interest. This ensures that everything in your wardrobe works together, making outfit selection effortless.

Don't forget about versatility. Look for pieces that can be worn in multiple ways—a wrap dress that works for the office and evening, a cardigan that can be worn open or buttoned, or trousers that can be rolled up for a casual look.

Accessories play a crucial role in a capsule wardrobe. A few well-chosen pieces can completely transform an outfit. Invest in quality leather goods, timeless jewelry, and classic shoes that will elevate your looks without cluttering your closet.

Remember, building a capsule wardrobe is a journey, not a destination. Start small, experiment with what works for your lifestyle, and gradually refine your collection until it perfectly reflects your personal style while serving your practical needs.`,
        excerpt:
          "Learn how to build a functional and stylish capsule wardrobe with essential pieces that work together seamlessly.",
        tags: JSON.stringify([
          "minimalism",
          "capsule-wardrobe",
          "style-tips",
          "organization",
          "quality",
        ]),
        category: "Style Guide",
        view_count: 890,
        featured_images: JSON.stringify([
          "capsule-wardrobe-essentials.jpg",
          "minimalist-style.jpg",
        ]),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: "Sustainable Fashion: How to Shop Responsibly",
        content: `The fashion industry is one of the largest polluters globally, but as consumers, we have the power to drive change through our purchasing decisions. Sustainable fashion is about more than just buying organic cotton—it's a holistic approach to how we consume, care for, and dispose of clothing.

Start by researching brands that align with your values. Look for transparency in their supply chain, fair labor practices, and environmental commitments. Certifications like Fair Trade, GOTS (Global Organic Textile Standard), and B Corp can help identify genuinely sustainable companies.

Quality over quantity should be your mantra. Instead of buying multiple cheap items, invest in fewer, better-made pieces that will last longer. This not only reduces waste but often saves money in the long run. Check for quality indicators like sturdy seams, natural fibers, and durable hardware.

Second-hand shopping is one of the most sustainable choices you can make. Thrift stores, consignment shops, and online platforms like Poshmark and Depop offer pre-loved fashion at a fraction of the original price. Each second-hand purchase saves resources and extends the life of existing garments.

When you do buy new, consider the materials. Natural fibers like organic cotton, linen, hemp, and wool have lower environmental impacts than synthetic alternatives. Innovative materials like Tencel, recycled polyester, and Piñatex (pineapple leather) are also great options.

Care for your clothes properly to extend their lifespan. Wash in cold water, air dry when possible, and learn basic mending skills. Simple repairs can significantly extend a garment's life, keeping it out of landfills.

Finally, when clothes are truly worn out, dispose of them responsibly. Textile recycling programs, donation centers, and upcycling projects can give old clothes new life. Some brands even offer take-back programs for their old products.

Remember, sustainable fashion is a journey, not perfection. Every conscious choice, no matter how small, contributes to a more sustainable future for fashion.`,
        excerpt:
          "Discover practical ways to shop sustainably and make environmentally conscious fashion choices without sacrificing style.",
        tags: JSON.stringify([
          "sustainability",
          "eco-fashion",
          "ethical",
          "shopping-tips",
          "environment",
        ]),
        category: "Sustainable Fashion",
        view_count: 1567,
        featured_images: JSON.stringify([
          "sustainable-fashion.jpg",
          "eco-friendly-shopping.jpg",
          "ethical-brands.jpg",
        ]),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: "Street Style Evolution: From Subculture to Mainstream",
        content: `Street style has transformed from underground subculture to a dominant force in fashion, influencing everything from high-end runway collections to everyday wardrobes. What started as a way for youth to express their identity has become a global phenomenon that shapes trends and challenges traditional fashion hierarchies.

The origins of street style can be traced back to various subcultures—punk, hip-hop, skate, and grunge—each with their distinctive aesthetic. These movements were about more than just clothing; they were statements of identity, rebellion, and community. The DIY ethos of punk, the baggy silhouettes of hip-hop, the relaxed vibe of skate culture, and the thrift-store aesthetic of grunge all contributed to what we now call street style.

Social media has revolutionized how street style is documented and disseminated. Instagram, TikTok, and Pinterest have democratized fashion photography, allowing anyone to become a style influencer. Street style photographers like Scott Schuman (The Sartorialist) and Tommy Ton turned their lenses away from the runway to capture authentic style moments on city streets worldwide.

Today, street style is a major influence on luxury fashion. Designers regularly draw inspiration from what people are wearing on the streets, creating a feedback loop between consumer creativity and high fashion. Collaborations between streetwear brands and luxury houses have become commonplace, blurring the lines between subculture and couture.

The globalization of street style has created fascinating regional variations. Tokyo's Harajuku district brings playful, experimental looks, while Seoul's fashion scene combines traditional elements with modern aesthetics. European cities like Paris and London offer their own interpretations, mixing heritage with contemporary edge.

What makes street style so compelling is its authenticity and diversity. Unlike the polished perfection of runway shows, street style is real, imperfect, and deeply personal. It's about individual expression rather than following trends, though it inevitably creates them.

As we look to the future, street style continues to evolve, incorporating sustainability, technology, and cultural exchange. It remains a powerful form of self-expression and a testament to fashion's ability to adapt, transform, and reflect the times we live in.`,
        excerpt:
          "Explore how street style evolved from underground subcultures to become a major influence on mainstream fashion and luxury brands.",
        tags: JSON.stringify([
          "street-style",
          "urban-fashion",
          "subculture",
          "influencer",
          "trend-forecasting",
        ]),
        category: "Fashion Culture",
        view_count: 2103,
        featured_images: JSON.stringify([
          "https://picsum.photos/seed/street-style-evolution/300/300",
          "https://picsum.photos/seed/urban-fashion/300/300",
          "https://picsum.photos/seed/fashion-subcultures/300/300",
        ]),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: "Color Theory in Fashion: Creating Harmonious Outfits",
        content: `Understanding color theory is essential for creating visually appealing and harmonious outfits. The right color combinations can enhance your appearance, convey mood, and make a powerful style statement. Let's explore how to use color effectively in your wardrobe.

The color wheel is your best friend when it comes to creating outfits. Complementary colors (opposite each other on the wheel, like blue and orange) create high contrast and visual excitement. Analogous colors (next to each other, like blue, blue-green, and green) create a more subtle, sophisticated harmony.

Monochromatic dressing—wearing different shades of the same color—creates an elegant, elongated silhouette. Try pairing navy blue with light blue and royal blue for a sophisticated look that's easy to pull off. This approach is especially effective for creating a cohesive, polished appearance.

Neutral colors (black, white, gray, beige, navy) form the foundation of most wardrobes for good reason. They're versatile, timeless, and easy to mix with other colors. A well-curated neutral base allows you to add pops of color through accessories or statement pieces.

Consider your skin's undertone when choosing colors. Warm undertones pair beautifully with earth tones, warm reds, oranges, and yellows. Cool undertones are enhanced by jewel tones, cool blues, purples, and pinks. If you're unsure, look at the veins on your wrist—blue veins suggest cool undertones, while green veins indicate warm undertones.

The 60-30-10 rule is a helpful guideline for color proportions in outfits. Use 60% of your dominant color, 30% of a secondary color, and 10% of an accent color. This creates a balanced, harmonious look without being overwhelming.

Don't be afraid to experiment with color blocking—wearing solid blocks of contrasting colors. This bold approach can create striking, modern looks when done thoughtfully. Start with two complementary colors and add a neutral to ground the outfit.

Seasonal color palettes can guide your choices throughout the year. Spring calls for pastels and bright florals, summer embraces bold tropical colors, autumn features rich earth tones, and winter offers deep jewel tones and icy pastels.

Remember, color is personal and should make you feel confident. While these guidelines are helpful, the most important rule is to wear what makes you happy and reflects your personality. Fashion is about self-expression, and color is one of the most powerful tools at your disposal.`,
        excerpt:
          "Master the art of color coordination in fashion with practical tips on creating harmonious and visually appealing outfits.",
        tags: JSON.stringify([
          "color-theory",
          "style-tips",
          "coordination",
          "fashion-basics",
          "outfit-planning",
        ]),
        category: "Style Guide",
        view_count: 745,
        featured_images: JSON.stringify([
          "https://picsum.photos/1600/900",
          "https://picsum.photos/1600/900",
        ]),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: "The Business of Fashion: Building Your Brand",
        content: `Turning your passion for fashion into a successful business requires more than just creative talent—it demands strategic planning, business acumen, and a deep understanding of the industry. Whether you're dreaming of launching a clothing line, opening a boutique, or becoming a fashion influencer, here's how to build a sustainable fashion brand.

Start by defining your unique value proposition. What makes your brand different from the thousands of others in the market? Is it your sustainable practices, your focus on a specific niche, your innovative designs, or your exceptional customer service? Your unique selling proposition will guide all your business decisions.

Market research is crucial. Study your target audience, understand their needs and preferences, and analyze your competitors. Look for gaps in the market that your brand can fill. This research will inform everything from your product development to your marketing strategy.

A strong brand identity is essential in the crowded fashion marketplace. This includes your brand name, logo, visual aesthetic, and brand voice. Consistency across all touchpoints—from your website to social media to packaging—helps build recognition and trust with customers.

Financial planning often gets overlooked by creative entrepreneurs, but it's critical for success. Create a detailed business plan with realistic revenue projections, startup costs, and ongoing expenses. Consider how you'll fund your business—through savings, loans, investors, or crowdfunding.

In today's digital age, an online presence is non-negotiable. Build a professional website that showcases your products and tells your brand story. Use social media platforms strategically, focusing on those where your target audience spends their time. Engage with your followers authentically and consistently.

Supply chain management can make or break a fashion business. Research manufacturers, suppliers, and distributors carefully. Build relationships based on trust and clear communication. Consider factors like minimum order quantities, production timelines, and quality control processes.

Marketing and PR are essential for getting your brand noticed. Develop a comprehensive marketing strategy that includes social media marketing, email campaigns, influencer partnerships, and possibly traditional advertising. Consider hiring a PR agency or consultant if budget allows.

Customer service should be at the heart of your business. Respond promptly to inquiries, handle returns gracefully, and go above and beyond to create positive experiences. Happy customers become repeat customers and brand ambassadors.

Finally, stay adaptable and keep learning. The fashion industry is constantly evolving, and successful brands are those that can pivot when needed. Stay informed about industry trends, consumer behavior, and new technologies that could impact your business.

Building a fashion brand is a marathon, not a sprint. It requires passion, perseverance, and patience. But with the right strategy and execution, your fashion dreams can become a thriving business reality.`,
        excerpt:
          "Learn the essential steps to build a successful fashion business, from brand identity to financial planning and marketing strategies.",
        tags: JSON.stringify([
          "business",
          "entrepreneurship",
          "branding",
          "fashion-business",
          "startup",
        ]),
        category: "Fashion Business",
        view_count: 1589,
        featured_images: JSON.stringify([
          "https://picsum.photos/1600/900",
          "https://picsum.photos/1600/900",
          "https://picsum.photos/1600/900",
        ]),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: "Vintage Fashion: Timeless Style from Past Decades",
        content: `Vintage fashion offers a unique opportunity to connect with style history while creating distinctive looks that stand out in today's fast-fashion world. Each decade brings its own aesthetic treasures, from the elegant silhouettes of the 1920s to the bold expressions of the 1980s.

The 1920s gave us the flapper era—a revolutionary departure from Victorian constraints. Drop-waist dresses, cloche hats, and beaded embellishments defined this period of newfound freedom. Art Deco influences appeared in geometric patterns and luxurious materials, creating looks that still feel modern today.

Moving into the 1930s, fashion responded to economic challenges with more practical designs while maintaining elegance. Bias-cut dresses that draped beautifully on the body, broad-shouldered suits, and feminine details like ruffles and bows characterized this era. Hollywood glamour influenced everyday style, bringing sophistication to mainstream fashion.

The 1940s saw wartime restrictions leading to creative solutions. Utility clothing with functional details, padded shoulders, and A-line skirts became standard. Despite fabric rationing, women found ways to maintain style through accessories and clever alterations. This decade taught us that constraints can breed creativity.

Post-war 1950s fashion celebrated femininity with full skirts, cinched waists, and elegant hourglass silhouettes. The emergence of teenage culture brought rock and roll influences, leather jackets, and denim. This era's emphasis on polished, put-together looks continues to inspire modern formal wear.

The 1960s was a decade of dramatic contrasts. Early years brought elegant shifts and Jackie Kennedy's refined style, while later years embraced mod fashion, psychedelic patterns, and hippie aesthetics. Mini skirts, bold geometric prints, and experimental materials defined this revolutionary period.

Disco dominated the 1970s, bringing polyester, platform shoes, and glamorous evening wear. But this decade also embraced bohemian influences, with flowing maxi dresses, fringe details, and ethnic-inspired patterns. The varied aesthetics of the 70s offer something for every vintage lover.

The 1980s was all about excess—big shoulders, bold colors, and statement everything. Power dressing with oversized blazers, aerobic wear with leotards and leg warmers, and punk influences with ripped denim and leather created diverse style options. This decade's maximalist approach continues to inspire contemporary fashion.

When shopping for vintage, condition is key. Check for stains, tears, and odors that might be difficult to remove. Understand that sizing has changed over decades—always try before buying or get measurements. Look for quality construction and materials that have stood the test of time.

Incorporating vintage into modern wardrobes requires balance. Pair a vintage statement piece with contemporary basics to create a look that's current rather than costume. Don't be afraid to alter vintage pieces to fit better or suit your style—fashion is meant to be lived in, not just preserved.

Vintage fashion isn't just about wearing old clothes—it's about appreciating craftsmanship, understanding style evolution, and making sustainable choices. Each vintage piece has a story to tell, and when you wear it, you become part of that continuing narrative.`,
        excerpt:
          "Explore the evolution of fashion through vintage pieces from different decades and learn how to incorporate them into modern wardrobes.",
        tags: JSON.stringify([
          "vintage",
          "retro-fashion",
          "history",
          "sustainable",
          "timeless-style",
        ]),
        category: "Fashion History",
        view_count: 934,
        featured_images: JSON.stringify([
          "vintage-fashion.jpg",
          "retro-styles.jpg",
          "fashion-history.jpg",
        ]),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: "Accessory Essentials: Elevating Your Outfits",
        content: `Accessories are the finishing touches that transform good outfits into great ones. They have the power to completely change the mood, formality, and impact of your look. Understanding how to select and style accessories is essential for developing a sophisticated personal style.

Bags are both functional and fashionable. Invest in a few high-quality pieces that serve different purposes: a structured tote for work, a crossbody for casual outings, a clutch for evening events, and a backpack for weekends. Consider neutral colors for versatility, but don't shy away from a statement piece that reflects your personality.

Shoes can make or break an outfit. Build a collection that covers all bases: comfortable sneakers for casual days, elegant flats for everyday wear, classic pumps for professional settings, ankle boots for transitional weather, and statement heels for special occasions. Quality shoes are worth the investment—they affect your comfort and posture.

Jewelry adds sparkle and personality to any look. Start with basics like stud earrings, a simple necklace, and a versatile watch. Then add pieces that speak to your style—whether that's delicate layered necklaces, bold statement earrings, stacked bracelets, or meaningful rings. Mix metals if it suits your style; modern fashion rules are more flexible than ever.

Scarves are incredibly versatile accessories that can be worn year-round. Silk scarves add elegance to professional outfits, wool scarves provide warmth and texture in winter, and lightweight cotton scarves work beautifully in spring and summer. Learn different tying techniques to maximize their styling potential.

Belts do more than hold up pants—they define waists, add polish to dresses, and create visual interest in layered looks. Have a few options in different widths and colors. A classic leather belt in neutral brown or black is essential, but consider adding a statement belt with a distinctive buckle.

Hats can instantly elevate your style while providing practical benefits. A classic fedora adds sophistication, a beanie brings casual cool, a sun hat offers protection and glamour, and a beret adds Parisian chic. Start with one style that feels natural to you and build from there.

Sunglasses combine function with fashion. Choose styles that complement your face shape while reflecting your personality. Classic aviators, wayfarers, and cat-eye frames are timeless options that work with many face shapes.

When it comes to accessorizing, balance is key. If you're wearing a statement necklace, keep earrings subtle. If your outfit is bold and patterned, opt for simpler accessories. Conversely, a monochromatic outfit can handle more dramatic accessories.

Consider the occasion when selecting accessories. Professional settings call for more restrained choices, while evening events allow for more glamour. Casual outings are perfect for expressing your personality through fun, playful pieces.

Don't forget about practicality. Your accessories should work with your lifestyle. If you're constantly on the go, choose comfortable shoes and a bag that holds everything you need. If you work with your hands, minimal rings and bracelets might be more practical.

Finally, let your accessories reflect your personality. They're often the most personal elements of your outfit, telling your story without words. Whether you prefer minimal and understated or bold and expressive, choose pieces that make you feel confident and authentic.`,
        excerpt:
          "Master the art of accessorizing with essential pieces that elevate any outfit from basic to brilliant.",
        tags: JSON.stringify([
          "accessories",
          "style-tips",
          "wardrobe-essentials",
          "fashion-basics",
          "outfit-elevation",
        ]),
        category: "Style Guide",
        view_count: 1123,
        featured_images: JSON.stringify([
          "fashion-accessories.jpg",
          "essential-bags.jpg",
          "jewelry-styling.jpg",
        ]),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: "Fashion Week Behind the Scenes: What Really Happens",
        content: `Fashion Week appears glamorous from the outside, but behind the runway lights lies a world of chaos, creativity, and incredible hard work. From New York to Paris, London to Milan, these biannual events are the pinnacle of the fashion industry, where trends are born and careers are made.

Months before the first model hits the runway, designers are finalizing collections. This process involves countless hours of sketching, fabric sourcing, pattern making, and fittings. Design teams work around the clock, often sleeping in their studios during the final weeks before the show. The creative vision must be translated from concept to reality, with every detail meticulously planned.

Venue selection is crucial to setting the tone for a show. Some designers choose traditional venues like grand hotels or museums, while others opt for industrial spaces, galleries, or even outdoor locations. The venue becomes part of the storytelling, enhancing the collection's message and creating an immersive experience for attendees.

Model casting is an art form in itself. Designers look for more than just physical attributes—they seek models who can embody the collection's spirit and bring the clothes to life. Walk practice, fitting sessions, and direction sessions ensure models understand the designer's vision for movement and attitude.

Backstage during fashion week is controlled chaos. Hair stylists, makeup artists, and dressers work in synchronized harmony to prepare models for their runway moments. Each model typically has 30-90 seconds between looks for complete changes—a feat that requires incredible teamwork and precision.

The front row is where fashion's power players gather. Editors from major publications, buyers from luxury department stores, celebrities, influencers, and industry insiders all vie for these coveted seats. Their presence can make or break a collection's success, as their reviews and orders determine commercial viability.

Photographers and videographers capture every moment, both on and off the runway. In today's digital age, social media coverage is almost as important as the physical show. Designers must consider how collections will photograph and translate to digital platforms, not just how they look in person.

After the final model walks, the real work begins. Buyers place orders that determine which pieces will actually be produced. Editors write reviews that can establish or damage a designer's reputation. The collection's success is measured not just in applause, but in commercial orders and media coverage.

Fashion Week's influence extends far beyond the runway. Street style outside the venues has become equally important, with influencers and editors showcasing their personal style. These looks often influence trends as much as the collections themselves.

The business side of Fashion Week is immense. Costs can range from $100,000 to over $1 million per show, depending on venue, models, production, and PR. Designers must balance creative expression with commercial reality, knowing that a successful show can lead to increased sales and brand recognition.

Despite the pressure and expense, Fashion Week remains essential to the fashion industry's ecosystem. It's where creativity meets commerce, where art becomes product, and where the future of fashion is revealed, one runway at a time.

For those dreaming of entering the fashion industry, understanding Fashion Week's complexity is crucial. It's not just about beautiful clothes—it's about business strategy, marketing, production, and the ability to translate creative vision into commercial success under intense pressure and scrutiny.`,
        excerpt:
          "Go behind the scenes of Fashion Week to discover the intense preparation, chaos, and business that powers these iconic industry events.",
        tags: JSON.stringify([
          "fashion-week",
          "runway",
          "industry",
          "behind-scenes",
          "fashion-business",
        ]),
        category: "Fashion Industry",
        view_count: 1876,
        featured_images: JSON.stringify([
          "fashion-week-backstage.jpg",
          "runway-show.jpg",
          "fashion-industry.jpg",
        ]),
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        title: "Denim Guide: Finding Your Perfect Fit",
        content: `Denim is the universal fabric of fashion—a staple in virtually every wardrobe worldwide. From classic blue jeans to denim jackets, skirts, and shirts, this versatile material has evolved from workwear to high fashion. Finding your perfect denim fit can transform your entire wardrobe, providing a foundation for countless stylish outfits.

Understanding denim quality is the first step. Look for weight (typically measured in ounces), with 10-12 oz being lightweight and perfect for warm weather, while 13-16 oz offers more structure and durability. The weave matters too—twill weaves create the classic diagonal pattern, while broken twill offers more stretch and comfort.

Body type plays a crucial role in finding the right fit. If you're pear-shaped, consider bootcut or flare styles that balance proportions. Apple shapes benefit from high-waisted styles that create definition. Rectangle body types can experiment with various cuts, while hourglass figures shine with fitted styles that accentuate curves.

The rise of jeans—high, mid, or low—affects both comfort and appearance. High-rise jeans sit at or above the natural waist, offering support and creating a vintage-inspired silhouette. Mid-rise hits between the waist and hips, providing versatility. Low-rise sits below the hips for a casual, youthful look.

Inseam length determines how jeans fall on your body. Petite individuals should look for shorter inseams (26-28 inches) to avoid bunching. Regular heights typically wear 30-32 inches, while tall individuals need 34+ inches for proper length. Remember that jeans can always be hemmed, but can't be lengthened.

Wash and finish dramatically affect denim's appearance. Light washes create a casual, relaxed vibe perfect for weekend wear. Medium and dark washes are more versatile, easily transitioning from casual to business casual. Distressed and ripped jeans add edge, while raw denim offers a purist approach that develops unique fade patterns over time.

Stretch versus non-stretch denim is another consideration. Stretch denim (typically 1-3% elastane) offers comfort and ease of movement, making it ideal for everyday wear. Non-stretch (100% cotton) provides more structure and durability, developing unique character over time.

Fit trends come and go, but classic styles endure. Skinny jeans, though recently challenged by wider cuts, remain wardrobe staples. Straight-leg jeans offer timeless versatility. Bootcut styles work well with boots and create a balanced silhouette. Wide-leg and flare jeans are currently trending, offering retro-inspired drama.

Care is crucial for denim longevity. Wash jeans inside out in cold water to preserve color and prevent fading. Avoid over-washing—denim doesn't need cleaning after every wear. Air dry when possible to prevent shrinkage and maintain shape. Spot clean between washes to extend wear time.

Building a denim collection starts with essentials. A great pair of dark wash skinny or straight-leg jeans works for almost any occasion. Add light wash for casual weekends, black jeans for evening wear, and perhaps a trendy style like wide-leg for fashion-forward moments.

Don't forget denim beyond jeans. A classic denim jacket adds casual cool to any outfit. Denim skirts offer feminine versatility. Denim shirts provide rugged charm. These pieces can be mixed and matched with your jeans for coordinated denim looks or contrasted for dynamic outfits.

Remember, the perfect denim should feel like a second skin—comfortable enough for all-day wear while making you feel confident and stylish. Don't be afraid to try different styles, brands, and fits until you find what works for your body and lifestyle.`,
        excerpt:
          "Complete guide to finding the perfect denim fit for your body type, style, and lifestyle with tips on quality, care, and trends.",
        tags: JSON.stringify([
          "denim",
          "jeans",
          "fit-guide",
          "wardrobe-essentials",
          "style-tips",
        ]),
        category: "Style Guide",
        view_count: 1456,
        featured_images: JSON.stringify([
          "denim-styles.jpg",
          "jeans-fit-guide.jpg",
          "denim-fashion.jpg",
        ]),
        created_at: new Date(),
        updated_at: new Date(),
      },
    ];

    await queryInterface.bulkInsert("journals", journals);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("journals", null, {});
  },
};
