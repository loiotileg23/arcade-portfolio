// Central registry of all tunnels (pipes) plus the castle.
// Each PROJECTS entry drives both the overworld pipe and the dedicated ProjectScene.
// To add a tunnel: append one entry here. No scene or store code changes needed.
//
// ─── Overworld fields ────────────────────────────────────────────────────────
//   id     — stable internal key for Phaser object refs
//   slug   — URL-safe identifier, used as the Zustand key
//   x      — world X position of the pipe (pixels)
//   number — two-digit tunnel number, shown on the pipe cap and the page header
//   label  — short in-world label rendered above the pipe
//
// ─── ProjectScene fields ─────────────────────────────────────────────────────
//   title      — full display name
//   tags       — one-line focus areas shown under the title
//   scoreboard — optional { title, stats: [{ value, label }] }, a stat grid under the header
//   intro      — optional lead paragraph under the header
//   entryLabel — numbers entries without their own kicker: 'PROJECT' → PROJECT // 01, 02, …
//   entries    — optional array of sub-projects / roles, each rendered as a case-study card:
//                { kicker, name, subtitle, url, buttonLabel, linkNote, meta, body, list, groups,
//                  overview, challenge, solution, results, sections }
//                kicker      — small label above the name (overrides the entryLabel number)
//                body        — lead paragraphs with no section label
//                list        — { label, items } rendered as a bulleted section
//                groups      — [{ label?, items: [{ name, role?, detail? }], note? }]
//                              labelled directories of tools, skills, or products
//                sections    — [{ label, body }] extra labelled sections, drawn last
//                url         — adds a full-width website button near the top of the card
//                buttonLabel — button text (default VIEW LIVE WEBSITE)
//                linkNote    — caption under the button (default "External site · Opens project website")
//                meta.stack / technology / capabilities render as tag chips; other meta as lines
//   highlights — array of short items, rendered as a bulleted HIGHLIGHTS section
//   meta       — optional object; keys listed in ProjectScene's META_FIELDS
//                (category, technology, degree, credential, role, industry, capabilities,
//                 timeline, stack, status)
//
//   Separate paragraphs inside any text field with '\n\n'.
//   media      — optional object: { placeholder, caption } — panel is skipped when absent
//   overview / challenge / solution / results
//              — optional paragraphs; any that are absent are skipped
//
// ─── Future CMS mapping (Supabase-ready) ─────────────────────────────────────
//   This structure maps cleanly to a `projects` table with:
//     - scalar columns: id, slug, number, title, tags, overview, challenge, solution, results, x, label
//     - array/jsonb:    highlights, meta, scoreboard, entries
//     - related table:  project_media (id, project_slug, url, type, caption, sort_order)
//   No ProjectScene logic changes will be required on migration — only the data source
//   switches from this file to a Supabase query.

const PROJECTS = [
  {
    id: 'project-1',
    slug: 'digital-ventures',
    number: '01',
    title: 'Digital Ventures',
    tags: 'Entrepreneurship · E-Commerce · Digital Media',
    entryLabel: 'PROJECT',
    intro:
      'Explore three independently developed digital ventures demonstrating my experience in commercial strategy, product development, technology integration, and business execution.',
    entries: [
      {
        name: 'Outlier News',
        subtitle: 'AI-Powered Digital Media Platform',
        url: 'https://outliernews.com/',
        meta: {
          category: 'Media Technology / AI',
          role:     'Founder / Product Developer',
          stack:    'Lovable · Supabase · PostgreSQL · APIs · AI Automation',
        },
        overview:
          'An independent digital media platform combining sports and technology journalism with AI-assisted content workflows and modern web architecture.',
        challenge:
          'Traditional digital publishing requires extensive research, content organization, editorial oversight, and multichannel distribution, creating opportunities for automation and improved operating efficiency.',
        solution:
          'Developed a centralized publishing platform integrating automated news ingestion, AI-assisted content generation, database management, duplicate detection, and editorial review workflows.',
        results:
          'Established a functioning web presence and core infrastructure for an AI-assisted newsroom, demonstrating applied software development, API integration, workflow automation, and digital product strategy.',
      },
      {
        name: 'Golf Garage',
        subtitle: 'Direct-to-Consumer Golf Retail',
        url: 'https://golfgarageshop.com/',
        meta: {
          category: 'E-Commerce / Consumer Products',
          role:     'Founder / Digital Commerce Development',
          stack:    'Shopify · E-Commerce Integrations · Digital Marketing',
        },
        overview:
          'An independently developed golf accessories brand focused on offering distinctive products through a direct-to-consumer digital shopping experience.',
        challenge:
          'Building a consumer retail brand requires product differentiation, effective merchandising, customer trust, payment integration, and a reliable online purchasing experience.',
        solution:
          'Created a branded Shopify storefront featuring golf accessories, integrated shopping functionality, organized product collections, and developed the digital retail experience.',
        results:
          'Established a customer-facing commerce platform and gained hands-on experience in consumer product positioning, e-commerce development, merchandising, and digital business operations.',
      },
      {
        name: 'Infamous Hoodies',
        subtitle: 'Streetwear & E-Commerce Development',
        url: 'https://infamoushoodies.com/',
        meta: {
          category: 'Apparel / Consumer Brand',
          role:     'Founder / Brand & E-Commerce Development',
          stack:    'Shopify · Print-on-Demand Integrations · Digital Design',
        },
        overview:
          'An independent streetwear venture combining creative brand development with digital commerce and technology-supported apparel production.',
        challenge:
          'Developing an apparel brand requires balancing design, product quality, brand identity, manufacturing costs, and the operational challenges of selling physical products.',
        solution:
          'Created an online commerce experience and explored integrated print-on-demand manufacturing to support product development without traditional inventory requirements.',
        results:
          'Developed an operational foundation for an independent apparel concept while building practical expertise in brand development, e-commerce integration, product experimentation, and consumer-facing digital experiences.',
      },
    ],
    x: 700,
    label: 'Digital Ventures',
  },
  {
    id: 'project-2',
    slug: 'the-forge',
    number: '02',
    title: 'The Forge',
    tags: 'Industrial Engineering · Technical Sales · Business Leadership',
    entryLabel: 'EXPERIENCE',
    scoreboard: {
      title: 'THE FORGE // CAREER HIGHLIGHTS',
      stats: [
        { value: '$8M',    label: 'Annual sales quota' },
        { value: '$12.5M', label: 'Managed portfolio' },
        { value: '$1.2M',  label: 'High-value transaction' },
        { value: '112.5%', label: 'Reported annual quota attainment' },
      ],
    },
    intro:
      'My professional foundation combines an engineering education with multimillion-dollar technical sales experience. I have worked with manufacturers, contractors, engineering teams, and enterprise stakeholders to turn complex technical requirements into commercially viable solutions.',
    entries: [
      {
        kicker: 'ENGINEERING FOUNDATION',
        name: 'Milwaukee School of Engineering (MSOE)',
        meta: {
          degree:     'Bachelor of Science, Industrial Engineering — 2019',
          credential: 'Six Sigma Green Belt',
        },
        body:
          'My Industrial Engineering education at the Milwaukee School of Engineering developed a foundation in systems thinking, process optimization, quantitative analysis, manufacturing operations, quality engineering, and human factors.' +
          '\n\nIndustrial engineering focuses on improving how people, processes, technology, and resources work together. This perspective has influenced my approach to both technical sales and software product development.' +
          '\n\nMy Six Sigma Green Belt further supports a structured, data-driven approach to identifying inefficiencies, analyzing root causes, and improving business processes.',
        list: {
          label: 'CORE COMPETENCIES',
          items: [
            'Process improvement and operational efficiency',
            'Statistical analysis and quality management',
            'Manufacturing and supply chain fundamentals',
            'Human factors, ergonomics, and user-centered design',
            'Systems optimization and problem solving',
            'Cross-functional technical communication',
          ],
        },
      },
      {
        name: 'IAC Acoustics',
        subtitle: 'Architectural Sales Management & Engineered Solutions',
        meta: {
          role:         'Architectural Sales Manager',
          industry:     'Architectural Engineering / Construction',
          capabilities: 'Enterprise Sales · Technical Consultation · Leadership · Strategic Accounts',
        },
        overview:
          'Led architectural sales initiatives involving highly engineered acoustic systems for complex construction and commercial environments.' +
          '\n\nManaged a significant portfolio of projects and relationships involving contractors, design professionals, technical teams, and other stakeholders.',
        challenge:
          'Large architectural projects require extensive coordination across engineering, design, installation, procurement, and commercial stakeholders. Sales cycles can extend beyond a year, requiring disciplined pipeline management and the ability to communicate technical value.',
        solution:
          'Managed complex opportunities through technical consultation, solution development, commercial negotiation, and cross-functional coordination.' +
          '\n\nLed a four-person team, supported distributor relationships, developed strategic accounts, and worked to align customer requirements with engineering capabilities and project execution.',
        results:
          'Managed a portfolio valued at approximately $12.5 million against an $8 million annual sales quota.' +
          '\n\nReported approximately $9 million against an $8 million annual target, representing 112.5% attainment. Supported high-value engineered projects reaching approximately $1 million.' +
          '\n\nDemonstrated enterprise relationship management, long-cycle deal execution, sales leadership, and commercial accountability.',
      },
      {
        name: 'Oakley Industrial Machinery',
        subtitle: 'International Technical Sales & Business Development',
        meta: {
          role:         'International Sales Manager',
          industry:     'Industrial Equipment / Manufacturing',
          capabilities: 'B2B Sales · Engineering Solutions · Negotiation · Account Development',
        },
        overview:
          'Managed industrial sales relationships across international markets, supporting customers purchasing specialized equipment and engineered manufacturing solutions.',
        challenge:
          'Industrial equipment purchases require significant capital investment, technical validation, multiple decision-makers, and a clear business justification.',
        solution:
          'Developed customer relationships, coordinated technical discussions, evaluated commercial opportunities, and managed complex negotiations.' +
          '\n\nWorked across sales and engineering functions to translate equipment capabilities into measurable customer value while managing an international portfolio.',
        results:
          'Closed a $1.2 million equipment transaction and exceeded sales objectives while managing an approximately $4 million international portfolio.' +
          '\n\nAlso led a two-person inside-sales team, developing experience in sales leadership, technical communication, and commercial execution.',
      },
      {
        name: 'Assurance Technologies',
        subtitle: 'Precision Metrology & Industrial Software Sales',
        meta: {
          role:         'Outside Technical Sales Engineer',
          industry:     'Manufacturing Technology / Metrology',
          capabilities: 'Solution Selling · Software Demonstrations · Technical Integration',
        },
        overview:
          'Supported manufacturing organizations with precision measurement equipment and statistical process control software used to monitor product quality and production performance.',
        challenge:
          'Manufacturers frequently operate measurement equipment from multiple vendors while facing challenges consolidating quality data, analyzing performance, and improving process consistency.',
        solution:
          'Consulted with customers on measurement solutions and demonstrated PROLINK statistical process control software, including its ability to consolidate data from equipment manufacturers such as Mitutoyo and Fowler.' +
          '\n\nCombined technical product knowledge, customer demonstrations, and application-focused selling to address manufacturing quality requirements.',
        results:
          'Managed an approximately $2 million sales territory across Illinois and Wisconsin while developing experience selling both industrial hardware and specialized software.' +
          '\n\nEstablished a professional foundation connecting engineering, software integration, customer problem-solving, and B2B technology sales.',
      },
    ],
    x: 1400,
    label: 'The Forge',
  },
  {
    id: 'project-3',
    slug: 'the-laboratory',
    number: '03',
    title: 'The Laboratory',
    tags: 'Artificial Intelligence · Software Development · Automation',
    entryLabel: 'PROJECT',
    intro:
      'I develop software and intelligent workflows designed to simplify operations, improve information accessibility, and create commercially valuable digital experiences.' +
      '\n\nMy approach combines modern development frameworks, cloud services, API integrations, and AI-assisted engineering.',
    entries: [
      {
        name: 'AI Content & Workflow Automation',
        subtitle: 'Intelligent Business Operations',
        meta: {
          category:   'AI / Automation',
          technology: 'LLM APIs · Supabase · Webhooks · Cloud Services',
        },
        overview:
          'An evolving system for coordinating AI-assisted content generation, brand workflows, and digital publishing operations.',
        challenge:
          'Businesses regularly manage repetitive processes involving content creation, formatting, approval, and distribution across disconnected platforms.',
        solution:
          'Developed structured workflows for managing brand-specific content, AI generation, platform-specific outputs, and review processes.' +
          '\n\nExplored integration patterns connecting language models, backend databases, automation triggers, and external publishing services.',
        results:
          'Created components of a reusable automation architecture applicable to marketing operations, content management, and other repetitive business processes.' +
          '\n\nDemonstrates practical understanding of AI orchestration, API connectivity, structured data, and process automation.',
      },
      {
        name: 'AI-Assisted Career Workflow Software',
        subtitle: 'Document Intelligence & Productivity',
        meta: {
          category:   'Software / Productivity',
          technology: 'AI APIs · Databases · Web Development',
        },
        overview:
          'A software product exploring the use of AI to improve professional document development, career organization, and information management.',
        challenge:
          'Managing professional applications requires repeated document modifications, job tracking, and the organization of large amounts of inconsistent information.',
        solution:
          'Developed product workflows around structured user information, resume customization, document generation, and application management.' +
          '\n\nCombined interface design with AI-assisted content processing and database-backed user workflows.',
        results:
          'Advanced the development of an AI-assisted productivity concept, applying knowledge of software architecture, data organization, automation, and user-centered product design.' +
          '\n\nDevelopment and refinement are ongoing.',
      },
      {
        name: 'Sports Data & Analytics System',
        subtitle: 'API Integration & Decision Intelligence',
        meta: {
          category:   'Data Technology / Analytics',
          technology: 'Sports APIs · PostgreSQL · Supabase · Automated Data Processing',
        },
        overview:
          'An analytics-focused software project designed to collect, organize, and evaluate frequently changing sports information.',
        challenge:
          'Sports data arrives from multiple sources and changes rapidly, creating challenges for consistent analysis, timely updates, and the evaluation of useful patterns.',
        solution:
          'Developed backend workflows for collecting structured API data, maintaining historical observations, and evaluating analytical signals.' +
          '\n\nThe system explores scheduled ingestion, probability-based evaluation, and data visualization to make complex information easier to interpret.',
        results:
          'Developed experience working with continuously updated external data, analytical models, backend processing, and automated information pipelines.',
      },
      {
        kicker: 'TOOLKIT',
        name: 'Development Toolchain',
        groups: [{ items: [
          {
            name: 'Lovable',
            role: 'Rapid Application Development',
            detail: 'Used to accelerate web application prototyping, develop user interfaces, and connect front-end experiences with backend services.',
          },
          {
            name: 'Cursor',
            role: 'AI-Assisted Development Environment',
            detail: 'Used for iterative code development, debugging, exploring existing codebases, and implementing application features.',
          },
          {
            name: 'Claude Code',
            role: 'Agentic Coding & Engineering',
            detail: 'Used for codebase analysis, development workflows, troubleshooting, and AI-assisted implementation across software projects.',
          },
          {
            name: 'Supabase & PostgreSQL',
            role: 'Backend Infrastructure',
            detail: 'Used for relational data modeling, authentication, access policies, database operations, and application state management.',
          },
          {
            name: 'Stripe',
            role: 'Payments Infrastructure',
            detail: 'Experience working with online payment and billing systems in software and digital business environments.',
          },
          {
            name: 'Shopify',
            role: 'Commerce Infrastructure',
            detail: 'Hands-on experience developing and managing digital storefronts, product catalogs, and e-commerce integrations.',
          },
          {
            name: 'GitHub & Cloud Services',
            role: 'Development Operations',
            detail: 'Version control, application integration, cloud-based workflows, and iterative software delivery.',
          },
        ] }],
        sections: [
          {
            label: 'DEVELOPMENT PHILOSOPHY',
            body:
              'AI accelerates implementation, but successful software still requires engineering judgment.' +
              '\n\nI focus on defining the problem, designing the system, validating functionality, and continuously improving the user experience. My background in industrial engineering reinforces a disciplined approach to building solutions that are practical, maintainable, and commercially relevant.',
          },
        ],
      },
    ],
    x: 2200,
    label: 'The Laboratory',
  },
]

// The castle at the end of the overworld — rendered by IdentityScene with the same
// fields as a tunnel (number, title, tags, intro, entries, …).
export const CASTLE = {
  number: '04',
  title: 'The Castle',
  tags: 'Software Development · Artificial Intelligence · Mobile Applications',
  entries: [
    {
      kicker: 'COMPANY',
      name: 'AppsArchitects Holdings',
      url: 'https://appsarchitects.com/',
      buttonLabel: 'VIEW COMPANY WEBSITE',
      linkNote: 'External site · Opens company website',
      body:
        'AppsArchitects Holdings is the foundation for my ongoing work in software development, AI-powered automation, and independent digital product creation.' +
        '\n\nThrough this venture, I am developing applications and platforms that combine practical business problems with modern technology.',
      groups: [
        {
          label: 'TECHNOLOGY & ENGINEERING EXPERIENCE',
          items: [
            {
              name: 'Cross-Platform Mobile Development',
              detail: 'Flutter, Dart, iOS development, Xcode, and responsive mobile interfaces.',
            },
            {
              name: 'Backend Infrastructure',
              detail: 'Supabase, PostgreSQL, Firebase services, authentication, relational databases, and cloud integration.',
            },
            {
              name: 'AI-Assisted Software Engineering',
              detail: 'Cursor, Claude Code, Lovable, language model integrations, rapid prototyping, and iterative development workflows.',
            },
            {
              name: 'Commerce & Business Integrations',
              detail: 'Shopify, Stripe, payment processing concepts, API integration, and digital business systems.',
            },
          ],
        },
        {
          label: 'MOBILE APPLICATIONS IN DEVELOPMENT',
          items: [
            {
              name: 'Social Discovery & Event Management',
              detail: 'A mobile platform exploring location-aware experiences, event coordination, social interaction, and user-generated activities.',
            },
            {
              name: 'Personalized Gifting & Social Commerce',
              detail: 'A consumer application exploring collaborative wishlists, gift discovery, social connections, and gifting coordination.',
            },
            {
              name: 'Interactive Sports & Community Engagement',
              detail: 'A sports-focused mobile experience combining interactive game mechanics, event data, social participation, and backend automation.',
            },
          ],
          note: 'All three projects are currently in development. Product identities and select implementation details are intentionally withheld.',
        },
      ],
      sections: [
        {
          label: 'DEVELOPMENT APPROACH',
          body:
            'My professional foundation in industrial engineering, Six Sigma methodology, and technical B2B sales informs how I approach software development.' +
            '\n\nI build with attention to user needs, system efficiency, operational practicality, and commercial potential.',
        },
      ],
    },
  ],
}

export default PROJECTS
