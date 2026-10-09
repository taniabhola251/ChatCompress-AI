import { useEffect, useMemo, useState } from 'react'
import JSZip from 'jszip'
import './App.css'

const navItems = [
  'Overview',
  'All Conversations',
  'Priority Inbox',
  'Mentions',
  'Action Items',
  'Deadlines',
  'Decisions',
  'Questions',
  'Repeated Requests',
  'Timeline',
  'Smart Search',
  'Privacy Center',
  'Settings',
]

const sampleConversation = `
[09/10/26, 9:05 AM] Rahul: Morning team! We need to lock our campus sustainability project plan this week.
[09/10/26, 9:08 AM] Maya: I found the greenhouse energy data from last semester.
[09/10/26, 9:12 AM] Daniel: Should we focus the presentation on solar panels or food-waste reduction?
[09/10/26, 9:15 AM] Priya: The professor said we need one clear recommendation, not both.
[09/10/26, 9:20 AM] Rahul: Let's compare the cost estimates before choosing.
[09/10/26, 9:26 AM] Maya: I can prepare the solar panel slides.
[09/10/26, 9:29 AM] Daniel: I'll check the food-waste numbers and share a chart.
[09/10/26, 9:34 AM] Priya: Can someone send me the latest project brief?
[09/10/26, 9:42 AM] Rahul: I uploaded the brief to the group drive.
[09/10/26, 10:02 AM] Maya: The solar estimate is 18% lower than last year after the new rebate.
[09/10/26, 10:13 AM] Daniel: The food-waste numbers are ready too. Composting could cut waste by about a third.
[09/10/26, 10:20 AM] Priya: Which option has stronger evidence for the final report?
[09/10/26, 10:31 AM] Rahul: Let's use solar as our main recommendation and mention composting as a future phase.
[09/10/26, 10:34 AM] Maya: Agreed. I'll update the slides with the solar recommendation.
[09/10/26, 10:41 AM] Daniel: I'll add the composting comparison to the appendix.
[09/10/26, 11:03 AM] Priya: We need to submit the report by Friday at 5 PM.
[09/10/26, 11:07 AM] Rahul: @You, can you review the budget table before Thursday? We need it for the report.
[09/10/26, 11:11 AM] You: Yes, I'll check the budget table tonight.
[09/10/26, 11:24 AM] Maya: The professor moved tomorrow's check-in from 2 PM to 3:30 PM.
[09/10/26, 11:29 AM] Daniel: Thanks, I've updated my calendar.
[09/10/26, 11:37 AM] Priya: Is anyone able to confirm the room number for tomorrow?
[09/10/26, 11:43 AM] Rahul: Still waiting on the room confirmation from the department.
[09/10/26, 12:02 PM] Priya: Reminder: please upload the final project brief to the shared folder.
[09/10/26, 12:18 PM] Priya: Following up on the project brief — can someone upload it today?
[09/10/26, 12:25 PM] Maya: Urgent: the submission portal closes Friday at 5 PM sharp.
[09/10/26, 12:31 PM] Daniel: I'll proofread the report after the budget table is ready.
[09/10/26, 12:44 PM] Rahul: Great, final plan is solar recommendation, composting appendix, and one combined report.
[09/10/26, 1:06 PM] Maya: Anyone know if we should include the raw survey spreadsheet?
[09/10/26, 1:15 PM] Priya: I'll ask the professor and reply here.
[09/10/26, 1:22 PM] Rahul: Perfect, let's keep the current slide design until we hear back.
`.trim()

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024
const MAX_CHAT_TEXT_BYTES = 20 * 1024 * 1024

const stopWords = new Set([
  'the','a','an','and','or','but','if','for','with','from','into','out','over','under','about','after','before','during','while','that','this','these','those','what','when','where','who','why','how','your','you','our','we','they','them','their','is','are','was','were','been','being','to','of','on','in','at','by','it','its','i','ll','re','ve','as','be','am','have','has','had','do','does','did','can','could','should','would','will','just','all','also','very','more','most','not','no','yes','please','thanks','thank','hey','hi','there','here','quite','then','than','into','up','down','today','tomorrow','friday','monday','tuesday','wednesday','thursday','saturday','sunday','pm','am','meet','meeting','team','project'
])

function parseConversation(rawText) {
  if (!rawText || !rawText.trim()) {
    return []
  }

  const lines = rawText.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\r/g, '').split('\n')
  const messages = []
  let current = null

  const pushCurrent = () => {
    if (!current) return
    const text = current.text.trim()
    if (text) {
      messages.push({
        ...current,
        text,
      })
    }
    current = null
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (current) {
        current.text += ' '
      }
      continue
    }

    const match = trimmed.match(/^\[(.+?)\]\s*([^:]+):\s*(.*)$/)
    const directMatch = trimmed.match(/^((?:\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}),?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\s*(?:[-–]\s*)?([^:]+):\s*(.*)$/i)
    const simpleMatch = trimmed.match(/^([^:]{1,80}):\s*(.*)$/)
    const systemMatch = trimmed.match(/^(Messages and calls are|This message was|Media omitted|.*encrypted.*)$/i)

    let nextMessage = null

    if (directMatch) {
      nextMessage = {
        timestamp: directMatch[1],
        sender: directMatch[2].trim(),
        text: directMatch[3].trim(),
      }
    } else if (match) {
      nextMessage = {
        timestamp: match[1],
        sender: match[2].trim(),
        text: match[3].trim(),
      }
    } else if (systemMatch) {
      nextMessage = { timestamp: '', sender: 'System', text: trimmed }
    } else if (current) {
      current.text += ` ${trimmed}`
      continue
    } else if (simpleMatch) {
      nextMessage = {
        timestamp: '',
        sender: simpleMatch[1].trim(),
        text: simpleMatch[2].trim(),
      }
    } else if (/^\s*[-*•]/.test(trimmed)) {
      current = { timestamp: '', sender: 'Bullet', text: trimmed.replace(/^\s*[-*•]\s*/, '') }
      pushCurrent()
      continue
    } else {
      nextMessage = { timestamp: '', sender: 'Message', text: trimmed }
    }

    if (nextMessage) {
      pushCurrent()
      current = nextMessage
    }
  }

  pushCurrent()

  return messages.filter((message) => message && message.text)
}

function getMessageDateInfo(timestamp) {
  const value = (timestamp || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim()
  const match = value.match(/\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/)
  if (!match) return null

  const parts = match[0].split(/[./-]/)
  let year
  let month
  let day
  if (parts[0].length === 4) {
    [year, month, day] = parts
  } else {
    const first = Number(parts[0])
    const second = Number(parts[1])
    const shortYear = Number(parts[2])
    year = String(shortYear < 70 ? 2000 + shortYear : shortYear < 100 ? 1900 + shortYear : shortYear)
    if (second > 12) {
      [month, day] = parts
    } else {
      [day, month] = parts
    }
    if (first > 12) [day, month] = parts
  }

  const dateKey = `${String(Number(year)).padStart(4, '0')}-${String(Number(month)).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
  return { key: dateKey, label: match[0] }
}

function getMessageTime(timestamp) {
  return (timestamp || '').match(/\b\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?\b/i)?.[0] || timestamp || 'Time not included'
}

function groupMessagesByDate(messages) {
  const groupsByDate = new Map()
  messages.forEach((message, index) => {
    const date = getMessageDateInfo(message.timestamp)
    const dateKey = date?.key || 'undated'
    let group = groupsByDate.get(dateKey)
    if (!group) {
      group = { key: dateKey, dateKey, label: date?.label || 'Date not included in export', messages: [] }
      groupsByDate.set(dateKey, group)
    }
    group.messages.push({ message, index })
  })

  return [...groupsByDate.values()]
    .sort((left, right) => {
      const leftUndated = left.dateKey === 'undated'
      const rightUndated = right.dateKey === 'undated'
      if (leftUndated !== rightUndated) return leftUndated ? 1 : -1
      return right.dateKey.localeCompare(left.dateKey)
    })
    .map((group) => ({
      ...group,
      messages: group.messages
        .sort((left, right) => right.message.score - left.message.score || left.index - right.index)
        .map(({ message }) => message),
    }))
}

function cleanText(text) {
  return text.replace(/\s+/g, ' ').trim()
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function includesMention(text, name) {
  const candidate = (name || 'You').trim()
  if (!candidate) return false
  const escapedName = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])@?${escapedName}(?=$|[^\\p{L}\\p{N}_])`, 'iu').test(text)
}

function detectDeadline(text) {
  const namedDate = '(?:today|tomorrow|tonight|next week|(?:next\\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))'
  const numericDate = '(?:\\d{1,2}[/-]\\d{1,2}(?:[/-]\\d{2,4})?)'
  const time = '(?:\\d{1,2}(?::\\d{2})?\\s?(?:AM|PM))'
  const deadlineMatch = text.match(new RegExp(`\\b(?:by|before|due(?:\\s+on)?|deadline(?:\\s+is)?)\\s+(?:${namedDate}|${numericDate})(?:\\s+at\\s+${time})?`, 'i'))
  if (deadlineMatch) {
    return deadlineMatch[0].replace(/^\s*(?:by|before|due(?:\s+on)?|deadline(?:\s+is)?)\s+/i, '')
  }

  const explicitDate = text.match(new RegExp(`\\b${namedDate}\\b|\\b${numericDate}\\b|\\b${time}\\b`, 'i'))
  return explicitDate?.[0] || ''
}

function detectMeetingChange(text) {
  return /\b(?:moved|move|reschedul\w*|cancelled|canceled|changed|delay\w*|shifted|revised)\b/i.test(text) && /\b(?:meeting|stand-up|call|session|check-in|review)\b/i.test(text)
}

function detectDecision(text) {
  return /\b(?:decided|agreed|confirmed|finali[sz]ed|approved|locked in|we chose|we have chosen|we(?:'|’)ve decided|decision is|final plan is|we(?:'|’)ll use|we will use|we(?:'|’)ll go with|we will go with|we(?:'|’)re going with|we are going with)\b/i.test(text)
}

function countWords(text) {
  return text.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token && !stopWords.has(token))
}

function buildPriorityScore(text, sender, userName) {
  let score = 0
  const lowerText = text.toLowerCase()
  const reasonParts = []

  if (includesMention(text, userName)) {
    score += 24
    reasonParts.push('direct mention of you')
  }

  if (/\b(?:urgent|asap|immediately|today|right away)\b/i.test(lowerText)) {
    score += 18
    reasonParts.push('urgent wording')
  }

  if (/\b(?:can you|could you|please|need you to|need to|reply|review|send|submit|confirm|check|upload|share|prepare|proofread|create|write|schedule|book|handle|take care of)\b/i.test(lowerText)) {
    score += 18
    reasonParts.push('explicit request or action')
  }

  if (/\bI(?:'|’)ll\b|\bI will\b|\bI can\b|\bI(?:'|’)m going to\b/i.test(text)) {
    score += 14
    reasonParts.push('stated commitment')
  }

  if (/\?/.test(text)) {
    score += 10
    reasonParts.push('question addressed to the group')
  }

  if (detectDeadline(lowerText)) {
    score += 20
    reasonParts.push('deadline or time-sensitive detail')
  }

  if (detectMeetingChange(lowerText)) {
    score += 18
    reasonParts.push('meeting change or cancellation')
  }

  if (detectDecision(lowerText)) {
    score += 12
    reasonParts.push('decision or plan update')
  }

  if (/\b(?:hi|hello|good morning|thanks|thank you|hey)\b/i.test(lowerText) && score === 0) {
    score += 3
    reasonParts.push('general conversation')
  }

  if (/\b(?:follow up|follow-up|reminder|again|still|waiting)\b/i.test(lowerText)) {
    score += 12
    reasonParts.push('repeat follow-up')
  }

  if (sender === 'System' || sender === 'Bullet') {
    score -= 5
  }

  return {
    score: Math.max(0, score),
    reasons: reasonParts,
  }
}

function toPriority(score) {
  if (score >= 35) return 'HIGH'
  if (score >= 20) return 'MEDIUM'
  return 'LOW'
}

function suggestAction(text, priority) {
  if (priority === 'HIGH') {
    if (detectDeadline(text)) return 'Confirm the deadline and respond before the due time.'
    if (/\?/.test(text)) return 'Reply to the direct question or request before the conversation cools off.'
    return 'Check the latest update and act on the request promptly.'
  }

  if (priority === 'MEDIUM') {
    return 'Keep this on your radar. It may need a quick follow-up.'
  }

  return 'Informational only; no immediate action required.'
}

function classifyMessageType(text) {
  if (/\b(?:deadline|by|before|due|submit|review|reply|send|complete|finish|tomorrow|today|friday|upload|share|prepare|proofread|create|write|schedule|book|handle)\b/i.test(text)
    || /\bI(?:'|’)ll\b|\bI will\b|\bI can\b|\bI(?:'|’)m going to\b/i.test(text)) {
    return 'Action required'
  }
  if (detectMeetingChange(text)) {
    return 'Meeting update'
  }
  if (detectDecision(text)) {
    return 'Decision'
  }
  if (/\?/.test(text)) {
    return 'Question'
  }
  return 'General'
}

function extractTasks(messages) {
  return messages
    .filter((message) => {
      const explicitRequest = /\b(?:please|can you|could you|need you to|submit|send|reply|review|complete|finish|confirm|check|upload|share|prepare|proofread|create|write|schedule|book|handle|take care of)\b/i.test(message.text)
      const commitment = /\bI(?:'|’)ll\b|\bI will\b|\bI can\b|\bI(?:'|’)m going to\b/i.test(message.text)
      const committedAction = /\b(?:update|submit|send|reply|review|complete|finish|confirm|check|upload|share|prepare|proofread|create|write|schedule|book|handle)\b/i.test(message.text)
      return explicitRequest || (commitment && committedAction) || /^\s*(?:please\s+)?update\b/i.test(message.text)
    })
    .map((message, index) => {
      const deadline = detectDeadline(message.text) || 'Needs confirmation'
      const assignment = /\b(?:@you|you|your)\b/i.test(message.text)
        ? 'You'
        : /\bI(?:'|’)ll\b|\bI will\b|\bI can\b|\bI(?:'|’)m going to\b/i.test(message.text)
          ? message.sender
          : 'Unassigned'

      return {
        id: `task-${message.id ?? index}`,
        description: cleanText(message.text.replace(/^(?:@You,?\s*)/i, '')),
        assigned: assignment,
        deadline,
        timestamp: message.timestamp,
        source: message.text,
        priority: message.priority,
      }
    })
}

function extractDecisions(messages) {
  return messages
    .filter((message) => detectDecision(message.text) || detectMeetingChange(message.text))
    .map((message, index) => ({
      id: `decision-${message.id ?? index}`,
      title: detectMeetingChange(message.text) ? 'Meeting update' : 'Decision made',
      detail: message.text,
      sender: message.sender,
      time: message.timestamp,
    }))
}

function findRepeatedRequests(messages) {
  const requestMessages = messages.filter((message) =>
    /\b(?:please|can you|could you|reminder|following up|follow[- ]?up|still waiting|upload|send|share)\b/i.test(message.text),
  )
  const repeated = []

  for (let left = 0; left < requestMessages.length; left += 1) {
    const leftTokens = new Set(countWords(requestMessages[left].text))
    for (let right = left + 1; right < requestMessages.length; right += 1) {
      const rightTokens = new Set(countWords(requestMessages[right].text))
      const shared = [...leftTokens].filter((token) => rightTokens.has(token))
      const shorterLength = Math.min(leftTokens.size, rightTokens.size)
      if (shared.length > 0 && shorterLength > 0 && shared.length / shorterLength >= 0.45) {
        repeated.push({ first: requestMessages[left], second: requestMessages[right], shared })
      }
    }
  }

  return repeated.slice(0, 6)
}

function buildTopicSummary(messages) {
  const words = messages.flatMap((message) => countWords(message.text))
  const frequency = {}

  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1
  }

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([word]) => word)
}

function buildAnalysis(messages, userName) {
  const rankedMessages = messages.map((message, index) => {
    const scoreResult = buildPriorityScore(message.text, message.sender, userName)
    const priority = toPriority(scoreResult.score)
    const reasonText = scoreResult.reasons.length
      ? `Priority ${priority} because this message contains ${scoreResult.reasons.join(', ')}.`
      : `Priority ${priority} because it is part of the current conversation flow.`

    return {
      ...message,
      id: `message-${index}`,
      priority,
      score: scoreResult.score,
      reason: reasonText,
      suggestedAction: suggestAction(message.text, priority),
      type: classifyMessageType(message.text),
      reviewed: false,
      timestamp: message.timestamp || 'No timestamp',
    }
  })

  const importantMessages = rankedMessages
    .filter((message) => message.priority !== 'LOW')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const questions = rankedMessages.filter((message) => /\?/.test(message.text))
  const deadlines = rankedMessages.filter((message) => detectDeadline(message.text))
  const actions = extractTasks(rankedMessages)
  const decisions = extractDecisions(rankedMessages)
  const topics = buildTopicSummary(rankedMessages)

  const summaryText = (() => {
    if (!rankedMessages.length) return 'No conversation loaded yet.'

    const topMessage = importantMessages[0]
    const topSentence = topMessage
      ? `The main issue is: “${cleanText(topMessage.text)}”`
      : topics.length
        ? `The conversation mainly discusses ${topics.join(', ')} across ${rankedMessages.length} messages.`
        : `The conversation includes ${rankedMessages.length} messages.`

    const decisionSentence = decisions[0]
      ? `There is a confirmed update: “${cleanText(decisions[0].detail)}”`
      : ''

    const actionSentence = actions[0]
      ? `A likely follow-up is: “${cleanText(actions[0].description)}”`
      : deadlines[0]
        ? `A date to note: “${cleanText(deadlines[0].text)}”`
        : ''

    return [topSentence, decisionSentence, actionSentence].filter(Boolean).join(' ')
  })()

  return {
    rankedMessages,
    importantMessages,
    summaryText,
    topics,
    questions,
    deadlines,
    actions,
    decisions,
  }
}

function App() {
  const [showDashboard, setShowDashboard] = useState(false)
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [activeTab, setActiveTab] = useState('Overview')
  const [inputText, setInputText] = useState('')
  const [analysisError, setAnalysisError] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const [previewCount, setPreviewCount] = useState(0)
  const [previewPending, setPreviewPending] = useState(false)
  const [inputExpanded, setInputExpanded] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [lightTheme, setLightTheme] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [fileSize, setFileSize] = useState('')
  const [visibleMessageCount, setVisibleMessageCount] = useState(50)
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [userName, setUserName] = useState('')
  const [searchText, setSearchText] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [conversationSearch, setConversationSearch] = useState('')
  const [reviewedIds, setReviewedIds] = useState([])
  const [taskState, setTaskState] = useState({})
  const [contextOpen, setContextOpen] = useState(null)
  const [filters, setFilters] = useState({
    priority: 'All',
    sender: 'All',
    topic: 'All',
    type: 'All',
  })

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((open) => !open)
        setCommandQuery('')
      } else if (event.key === 'Escape') {
        setCommandOpen(false)
        setResetOpen(false)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = lightTheme ? 'light' : 'dark'
  }, [lightTheme])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const updateVisibility = () => document.body.classList.toggle('page-hidden', document.hidden)
    document.addEventListener('visibilitychange', updateVisibility)
    updateVisibility()
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
      document.body.classList.remove('page-hidden')
    }
  }, [])

  useEffect(() => {
    if (fileName || !inputText.trim()) return

    const timer = setTimeout(() => {
      setPreviewCount(parseConversation(inputText).length)
      setPreviewPending(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [fileName, inputText])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchText), 200)
    return () => window.clearTimeout(timer)
  }, [searchText])

  const landingPreview = useMemo(
    () => buildAnalysis(parseConversation(sampleConversation), ''),
    [],
  )
  const inputPreview = useMemo(() => inputText.split(/\r?\n/, 5).slice(0, 4).join('\n'), [inputText])
  const inputPreviewHasMore = useMemo(
    () => inputText.slice(inputPreview.length).includes('\n'),
    [inputText, inputPreview],
  )
  const analysis = useMemo(() => buildAnalysis(messages, userName), [messages, userName])
  const repeatedRequests = useMemo(() => findRepeatedRequests(messages), [messages])
  const prioritySourceMessages = useMemo(
    () => conversations.length ? conversations.flatMap((conversation) => conversation.messages) : analysis.rankedMessages,
    [conversations, analysis.rankedMessages],
  )

  const filteredMessages = useMemo(() => {
    const filtered = prioritySourceMessages.filter((message) => {
      const matchesPriority = filters.priority === 'All' || message.priority === filters.priority
      const matchesSender = filters.sender === 'All' || message.sender === filters.sender
      const matchesType = filters.type === 'All' || message.type === filters.type
      const query = debouncedSearch.trim().toLowerCase()
      const matchesSearch = !query || `${message.sender} ${message.text} ${message.timestamp} ${message.type}`.toLowerCase().includes(query)

      const messageTopics = buildTopicSummary([message])
      const matchesTopic = filters.topic === 'All' || messageTopics.includes(filters.topic)

      return matchesPriority && matchesSender && matchesType && matchesTopic && matchesSearch
    })

    return filtered
  }, [prioritySourceMessages, filters, debouncedSearch])

  const senderOptions = ['All', ...new Set(prioritySourceMessages.map((message) => message.sender).filter(Boolean))]
  const topicOptions = ['All', ...new Set(buildTopicSummary(prioritySourceMessages))]
  const typeOptions = ['All', ...new Set(prioritySourceMessages.map((message) => message.type))]

  const remainingPriorityCount = prioritySourceMessages.filter(
    (message) => message.priority !== 'LOW' && !reviewedIds.includes(message.id),
  ).length
  const highPriorityCount = prioritySourceMessages.filter((message) => message.priority === 'HIGH').length

  const showHighPriorityMessages = () => {
    setVisibleMessageCount(50)
    setFilters({ priority: 'HIGH', sender: 'All', topic: 'All', type: 'All' })
    setSearchText('')
    setDebouncedSearch('')
    setActiveTab('Priority Inbox')
  }

  const executePaletteCommand = (command) => {
    setVisibleMessageCount(50)
    if (navItems.includes(command)) {
      setActiveTab(command)
      setCommandOpen(false)
      return
    }

    setSearchText(command)
    setActiveTab('Priority Inbox')
    setFilters({ priority: 'All', sender: 'All', topic: 'All', type: 'All' })
    setCommandOpen(false)
  }

  const handleAnalyze = () => {
    const parsed = parseConversation(inputText)
    if (!parsed.length) {
      setAnalysisError('Add a chat export or pasted conversation before analyzing.')
      return
    }

    const enriched = parsed.map((message, index) => ({
      ...message,
      text: cleanText(message.text),
      id: `message-${index}`,
      timestamp: message.timestamp || 'No timestamp',
    }))

    const conversationId = `conversation-${Date.now()}`
    const ranked = buildAnalysis(enriched, userName).rankedMessages.map((message) => ({
      ...message,
      id: `${conversationId}-${message.id}`,
    }))
    const title = fileName && !fileName.startsWith('fictional-demo')
      ? fileName.replace(/\.(?:txt|zip)$/i, '')
      : fileName.startsWith('fictional-demo')
        ? 'College sustainability project'
        : `Pasted conversation ${conversations.length + 1}`
    const newConversation = {
      id: conversationId,
      name: title,
      source: fileName || 'Pasted text',
      inputText,
      messages: ranked,
      updatedAt: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }
    setConversations((current) => [newConversation, ...current])
    setSelectedConversationId(conversationId)
    setMessages(ranked)
    setActiveTab('Overview')
    setAnalysisError('')
    setToast('Catch-up ready')
  }

  const loadDemo = () => {
    setInputText(sampleConversation)
    setFileName('fictional-demo-conversation.txt')
    setFileSize('')
    setPreviewCount(parseConversation(sampleConversation).length)
    setPreviewPending(false)
    setInputExpanded(false)
    setAnalysisError('')
    setShowDashboard(true)
    setWorkspaceReady(true)
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setPreviewPending(false)

    const lowerName = file.name.toLowerCase()
    const isZip = lowerName.endsWith('.zip')
    const isText = lowerName.endsWith('.txt')
    if (!isZip && !isText) {
      setInputText('')
      setFileName('')
      setFileSize('')
      setFileInputKey((current) => current + 1)
      setPreviewCount(0)
      setAnalysisError('Unsupported file type. Please upload a WhatsApp .txt export or .zip archive.')
      return
    }

    try {
      let text
      if (isZip) {
        if (file.size > MAX_ARCHIVE_BYTES) {
          throw new Error('The ZIP archive is larger than the 50 MB import limit.')
        }

        const archive = await JSZip.loadAsync(await file.arrayBuffer(), {
          createFolders: false,
        })
        const chatFiles = Object.values(archive.files).filter((entry) =>
          !entry.dir
          && !entry.name.startsWith('__MACOSX/')
          && entry.name.toLowerCase().endsWith('.txt'),
        )

        if (chatFiles.length !== 1) {
          throw new Error(
            chatFiles.length
              ? 'This ZIP contains more than one .txt file. Please upload an archive with a single chat export.'
              : 'No .txt chat export was found in this ZIP archive.',
          )
        }

        const chatFile = chatFiles[0]
        if (chatFile._data?.uncompressedSize > MAX_CHAT_TEXT_BYTES) {
          throw new Error('The chat text inside the ZIP is larger than the 20 MB import limit.')
        }
        text = await chatFile.async('string')
      } else {
        if (file.size > MAX_CHAT_TEXT_BYTES) {
          throw new Error('The text export is larger than the 20 MB import limit.')
        }
        text = await file.text()
      }

      const parsed = parseConversation(text)

      if (!parsed.length) {
        setInputText('')
        setFileName('')
        setFileSize('')
        setFileInputKey((current) => current + 1)
        setAnalysisError('The selected file is empty or does not contain readable chat messages.')
        setPreviewCount(0)
        return
      }

      setFileName(file.name)
      setInputText(text)
      setPreviewCount(parsed.length)
      setAnalysisError('')
      setFileSize(formatFileSize(file.size))
      setInputExpanded(false)
      setToast('Conversation imported')
      setShowDashboard(true)
      setWorkspaceReady(true)
    } catch (error) {
      setInputText('')
      setFileName('')
      setFileSize('')
      setFileInputKey((current) => current + 1)
      setAnalysisError(error instanceof Error && error.message
        ? error.message
        : 'The selected file could not be read. Please check that it is a valid .txt export or ZIP archive.')
      setPreviewCount(0)
    }
  }

  const handleFileDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) handleFileUpload({ target: { files: [file] } })
  }

  const cancelImport = () => {
    setInputText('')
    setFileName('')
    setPreviewCount(0)
    setPreviewPending(false)
    setFileSize('')
    setInputExpanded(false)
    setFileInputKey((current) => current + 1)
    setAnalysisError('')
  }

  const clearAllChatData = () => {
    setMessages([])
    setConversations([])
    setSelectedConversationId('')
    setInputText('')
    setFileName('')
    setFileInputKey((current) => current + 1)
    setPreviewCount(0)
    setPreviewPending(false)
    setFileSize('')
    setInputExpanded(false)
    setReviewedIds([])
    setTaskState({})
    setSearchText('')
    setDebouncedSearch('')
    setConversationSearch('')
    setVisibleMessageCount(50)
    setFilters({ priority: 'All', sender: 'All', topic: 'All', type: 'All' })
    setContextOpen(null)
    setAnalysisError('In-memory chat data cleared. The workspace is empty.')
    setActiveTab('Overview')
  }

  const markReviewed = (id) => {
    setReviewedIds((current) => (current.includes(id) ? current : [...current, id]))
  }

  const toggleTask = (taskId) => {
    setTaskState((current) => ({
      ...current,
      [taskId]: !current[taskId],
    }))
  }

  const selectConversation = (conversation) => {
    setSelectedConversationId(conversation.id)
    setInputText(conversation.inputText)
    setFileName(conversation.source)
    setFileSize('')
    setPreviewCount(conversation.messages.length)
    setPreviewPending(false)
    setInputExpanded(false)
    setMessages(conversation.messages)
    setActiveTab('Overview')
    setAnalysisError('')
  }

  const downloadBriefing = () => {
    const name = conversations.find((conversation) => conversation.id === selectedConversationId)?.name || 'Conversation'
    const sections = [
      `# ChatCompress briefing — ${name}`,
      '',
      '## Summary',
      analysis.summaryText,
      '',
      '## Important messages',
      ...analysis.importantMessages.map((message) => `- [${message.priority}] ${message.sender}: ${message.text}`),
      '',
      '## Action items',
      ...analysis.actions.map((task) => `- [${taskState[task.id] ? 'x' : ' '}] ${task.description} — Assigned: ${task.assigned}; Deadline: ${task.deadline}`),
      '',
      '## Deadlines',
      ...analysis.deadlines.map((message) => `- ${detectDeadline(message.text)} — ${message.text}`),
      '',
      '## Decisions',
      ...analysis.decisions.map((decision) => `- ${decision.detail}`),
      '',
      '## Potentially unanswered questions',
      ...analysis.questions.map((question) => `- ${question.sender}: ${question.text}`),
      '',
      'Generated locally by ChatCompress.',
    ]
    const blob = new Blob([sections.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'chatcompress-briefing.md'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const renderOverview = () => (
    <>
      <section className="summary-grid">
        <div className="summary-card accent">
          <span className="label">What happened</span>
          <strong>{analysis.summaryText || 'No conversation loaded yet.'}</strong>
        </div>
        <div className="summary-card">
          <span className="label">What matters most</span>
          <strong>{analysis.importantMessages[0]?.text || 'No high-priority messages yet.'}</strong>
        </div>
        <div className="summary-card">
          <span className="label">What to do next</span>
          <strong>{analysis.actions[0]?.description || 'Review the inbox and confirm follow-ups.'}</strong>
        </div>
      </section>

      <section className="panel important-points-panel" aria-labelledby="important-points-title">
        <div className="panel-header">
          <div>
            <span className="eyebrow">A FRIENDLY CATCH-UP</span>
            <h3 id="important-points-title">Important points, in simple words</h3>
            <p className="panel-subtitle">Here are the key things ChatCompress noticed, grouped so you can scan them quickly.</p>
          </div>
        </div>
        <p className="plain-summary">{analysis.summaryText || 'Import a conversation to get a simple summary of its key points.'}</p>
        <div className="important-points-grid">
          <article className="important-point-group attention">
            <h4><span aria-hidden="true">!</span> Messages to notice</h4>
            {analysis.importantMessages.length ? (
              <ul>{analysis.importantMessages.map((message) => <li key={message.id}>{message.sender}: {message.text}</li>)}</ul>
            ) : <p>No messages were flagged for extra attention.</p>}
          </article>
          <article className="important-point-group tasks">
            <h4><span aria-hidden="true">✓</span> Things to do</h4>
            {analysis.actions.length ? (
              <ul>{analysis.actions.map((action) => <li key={action.id}>{action.description} <small>({action.assigned === 'You' ? 'assigned to you' : `assigned to ${action.assigned.toLowerCase()}`}; date: {action.deadline})</small></li>)}</ul>
            ) : <p>No clear follow-up tasks were found.</p>}
          </article>
          <article className="important-point-group dates">
            <h4><span aria-hidden="true">◷</span> Dates to remember</h4>
            {analysis.deadlines.length ? (
              <ul>{analysis.deadlines.map((deadline) => <li key={deadline.id}>{detectDeadline(deadline.text)}: {deadline.text}</li>)}</ul>
            ) : <p>No dates or deadlines were found.</p>}
          </article>
          <article className="important-point-group decisions">
            <h4><span aria-hidden="true">◇</span> Decisions and updates</h4>
            {analysis.decisions.length ? (
              <ul>{analysis.decisions.map((decision) => <li key={decision.id}>{decision.detail}</li>)}</ul>
            ) : <p>No clear decisions or meeting updates were found.</p>}
          </article>
          <article className="important-point-group questions">
            <h4><span aria-hidden="true">?</span> Questions to follow up</h4>
            {analysis.questions.length ? (
              <ul>{analysis.questions.map((question) => <li key={question.id}>{question.sender}: {question.text}</li>)}</ul>
            ) : <p>No questions were found in this conversation.</p>}
          </article>
          <article className="important-point-group topics">
            <h4><span aria-hidden="true">✦</span> Main topics</h4>
            {analysis.topics.length
              ? <div className="topic-chips">{analysis.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
              : <p>There are not enough repeated words to identify main topics yet.</p>}
          </article>
          {repeatedRequests.length > 0 && (
            <article className="important-point-group repeats">
              <h4><span aria-hidden="true">↻</span> Requests that came up more than once</h4>
              <ul>{repeatedRequests.map((pair) => <li key={`${pair.first.id}-${pair.second.id}`}>{pair.first.text} <small>and</small> {pair.second.text}</li>)}</ul>
            </article>
          )}
        </div>
        <p className="important-points-note">These are suggestions from local text-matching rules. Please check the original messages before acting on them.</p>
      </section>

      <section className="panel-grid two-up">
        <div className="panel">
          <div className="panel-header">
            <h3>What did I miss?</h3>
            {messages.length > 0 && <button type="button" className="clear-button" onClick={downloadBriefing}>Export briefing</button>}
          </div>
          <ul className="detail-list">
            <li><span>Main topics</span><strong>{analysis.topics.length ? analysis.topics.join(', ') : 'None detected'}</strong></li>
            <li><span>Important announcements</span><strong>{analysis.importantMessages[0]?.text || 'No announcements detected'}</strong></li>
            <li><span>Decisions made</span><strong>{analysis.decisions[0]?.detail || 'No clear decision extracted'}</strong></li>
            <li><span>Upcoming events</span><strong>{analysis.deadlines[0]?.text || 'No milestone identified'}</strong></li>
            <li><span>Unanswered questions</span><strong>{analysis.questions[0]?.text || 'No direct question identified'}</strong></li>
            <li><span>Messages needing attention</span><strong>{analysis.importantMessages.length ? `${analysis.importantMessages.length} priority items` : 'No messages flagged'}</strong></li>
          </ul>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>10-second catch-up</h3>
          </div>
          <div className="catchup-box">
            <div>
              <span>What happened</span>
              <p>{analysis.summaryText}</p>
            </div>
            <div>
              <span>What matters most</span>
              <p>{analysis.importantMessages[0]?.reason || 'No urgency detected yet.'}</p>
            </div>
            <div>
              <span>What to do next</span>
              <p>{analysis.actions[0]?.description || 'No action required yet.'}</p>
            </div>
          </div>
        </div>
      </section>
      {repeatedRequests.length > 0 && (
        <section className="panel">
          <div className="panel-header"><h3>Repeated requests</h3></div>
          <p className="panel-subtitle">Possible repeats are estimated using shared keywords. Verify the original messages.</p>
          <div className="repeated-list">
            {repeatedRequests.slice(0, 3).map((pair) => (
              <article className="repeated-item" key={`${pair.first.id}-${pair.second.id}`}>
                <span className="roadmap-label">SIMILARITY ESTIMATE</span>
                <p><strong>{pair.first.sender}:</strong> {pair.first.text}</p>
                <p><strong>{pair.second.sender}:</strong> {pair.second.text}</p>
                <small>Shared terms: {pair.shared.join(', ')}</small>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  )

  const getContextMessages = (messageId) => {
    const source = conversations.find((conversation) => conversation.messages.some((message) => message.id === messageId))?.messages || analysis.rankedMessages
    const selectedIndex = source.findIndex((item) => item.id === messageId)
    return source.filter((_, index) => index >= Math.max(0, selectedIndex - 1) && index <= selectedIndex + 1)
  }

  const renderImportantMessages = () => {
    let remainingVisible = visibleMessageCount
    const visibleGroups = groupMessagesByDate(filteredMessages)
      .map((group) => {
        const visible = group.messages.slice(0, remainingVisible)
        remainingVisible -= visible.length
        return { ...group, messages: visible }
      })
      .filter((group) => group.messages.length)
    const shownMessageCount = visibleGroups.reduce((total, group) => total + group.messages.length, 0)

    return <section className="panel">
      <div className="panel-header priority-header">
        <div>
          <h3>Priority inbox</h3>
          <p className="panel-subtitle">Newest dates first; within each date, messages are ordered from high to low priority.</p>
        </div>
      </div>
      <div className="priority-toolbar">
        <input className="search-input" value={searchText} onChange={(event) => { setVisibleMessageCount(50); setSearchText(event.target.value) }} placeholder="Search messages…" aria-label="Search messages" />
        <div className="filter-row priority-filter-row">
          <select value={filters.priority} onChange={(event) => { setVisibleMessageCount(50); setFilters((current) => ({ ...current, priority: event.target.value })) }}>
            <option value="All">All priorities</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <select value={filters.sender} onChange={(event) => { setVisibleMessageCount(50); setFilters((current) => ({ ...current, sender: event.target.value })) }}>
            {senderOptions.map((sender) => (
              <option key={sender} value={sender}>{sender === 'All' ? 'All senders' : sender}</option>
            ))}
          </select>
          <select value={filters.type} onChange={(event) => { setVisibleMessageCount(50); setFilters((current) => ({ ...current, type: event.target.value })) }}>
            {typeOptions.map((type) => (
              <option key={type} value={type}>{type === 'All' ? 'All message types' : type}</option>
            ))}
          </select>
          <select value={filters.topic} onChange={(event) => { setVisibleMessageCount(50); setFilters((current) => ({ ...current, topic: event.target.value })) }}>
            {topicOptions.map((topic) => (
              <option key={topic} value={topic}>{topic === 'All' ? 'All topics' : topic}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="priority-quick-filters" aria-label="Priority filter">
        <button type="button" className={filters.priority === 'All' ? 'active' : ''} aria-pressed={filters.priority === 'All'} onClick={() => { setVisibleMessageCount(50); setFilters((current) => ({ ...current, priority: 'All' })) }}>All messages</button>
        <button type="button" className={filters.priority === 'HIGH' ? 'active' : ''} aria-pressed={filters.priority === 'HIGH'} onClick={() => { setVisibleMessageCount(50); setFilters((current) => ({ ...current, priority: 'HIGH' })) }}>
          High priority <span>{prioritySourceMessages.filter((message) => message.priority === 'HIGH').length}</span>
        </button>
      </div>

      <div className="message-list">
        {filteredMessages.length ? visibleGroups.map((group) => (
          <section className="dated-message-group" key={group.key}>
            <h4 className="date-divider">{group.label}</h4>
            {group.messages.map((message) => (
              <article key={message.id} className={`message-card priority-${message.priority.toLowerCase()}`}>
                <div className="message-header">
                  <div>
                    <span className="sender">{message.sender}</span>
                    <span className="timestamp">{getMessageTime(message.timestamp)}</span>
                  </div>
                  <div className="header-actions">
                    <span className={`priority-badge ${message.priority.toLowerCase()}`}>{message.priority}</span>
                    <button type="button" onClick={() => markReviewed(message.id)}>{reviewedIds.includes(message.id) ? 'Reviewed' : 'Mark as reviewed'}</button>
                  </div>
                </div>
                <p className="message-content">{message.text}</p>
                <div className="reason-block">
                  <strong>Why it matters:</strong> {message.reason}
                </div>
                <div className="message-meta">
                  <span>Type: {message.type}</span>
                  <span>Score: {message.score}</span>
                </div>
                <div className="message-actions">
                  <button type="button" onClick={() => setContextOpen(contextOpen === message.id ? null : message.id)}>Show original context</button>
                  <span>{message.suggestedAction}</span>
                </div>
                {contextOpen === message.id && (
                  <div className="context-box">
                    {getContextMessages(message.id).map((item) => (
                      <div key={item.id}>{item.sender}: {item.text}</div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>
        )) : <div className="empty-state">No messages match the current filters.</div>}
        {shownMessageCount < filteredMessages.length && (
          <button type="button" className="load-more-button" onClick={() => setVisibleMessageCount((count) => count + 50)}>
            Show 50 more messages <span>({filteredMessages.length - shownMessageCount} remaining)</span>
          </button>
        )}
      </div>
    </section>
  }

  const renderAllConversations = () => {
    const visibleConversations = conversations.filter((conversation) =>
      `${conversation.name} ${conversation.source}`.toLowerCase().includes(conversationSearch.trim().toLowerCase()),
    )

    return (
      <section className="panel">
        <div className="panel-header row">
          <div>
            <h3>All conversations</h3>
            <p className="panel-subtitle">Chats imported during this browser session only.</p>
          </div>
          <button type="button" className="primary-button" onClick={() => document.getElementById('conversation-input')?.focus()}>Import conversation</button>
        </div>
        <input className="search-input conversation-search" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Find a conversation…" aria-label="Find a conversation" />
        {visibleConversations.length ? (
          <div className="conversation-list">
            {visibleConversations.map((conversation) => {
              const attentionCount = conversation.messages.filter((message) => message.priority !== 'LOW' && !reviewedIds.includes(message.id)).length
              return (
                <button key={conversation.id} type="button" className={`conversation-row ${conversation.id === selectedConversationId ? 'selected' : ''}`} onClick={() => selectConversation(conversation)}>
                  <span className="conversation-avatar">{conversation.name.slice(0, 1).toUpperCase()}</span>
                  <span className="conversation-main">
                    <strong>{conversation.name}</strong>
                    <span>{conversation.source} · {conversation.messages.length} messages</span>
                    <small>{conversation.messages.at(-1)?.text || 'No message preview'}</small>
                  </span>
                  <span className="conversation-side">
                    <span>{conversation.updatedAt}</span>
                    {attentionCount > 0 && <b>{attentionCount} to review</b>}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">{conversations.length ? 'No conversations match your search.' : 'No conversations imported in this session yet. Use the import panel or try the demo.'}</div>
        )}
      </section>
    )
  }

  const renderMentions = () => {
    const escapedName = userName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const mentionPattern = escapedName
      ? new RegExp(`(?:^|[^\\p{L}\\p{N}_])@?${escapedName}(?=$|[^\\p{L}\\p{N}_])`, 'iu')
      : /@you\b/i
    const mentions = analysis.rankedMessages.filter((message) => mentionPattern.test(message.text))

    return (
      <section className="panel">
        <div className="panel-header"><h3>Mentions</h3></div>
        <p className="panel-subtitle">Potential mentions based on the name you set in Settings. Matches are approximate.</p>
        <div className="message-list">
          {mentions.length ? mentions.map((message) => (
            <article key={message.id} className="message-card priority-medium">
              <div className="message-header"><div><span className="sender">{message.sender}</span><span className="timestamp">{message.timestamp}</span></div><span className="priority-badge medium">POTENTIAL MENTION</span></div>
              <p className="message-content">{message.text}</p>
              <button type="button" className="context-link" onClick={() => { setContextOpen(message.id); setActiveTab('Priority Inbox') }}>View in priority inbox</button>
            </article>
          )) : <div className="empty-state">{userName ? `No potential mentions of “${userName}” found.` : 'Set your name in Settings to find potential mentions. Messages containing @You are shown when no name is set.'}</div>}
        </div>
      </section>
    )
  }

  const renderQuestions = () => (
    <section className="panel">
      <div className="panel-header"><h3>Potentially unanswered questions</h3></div>
      <p className="panel-subtitle">Questions are heuristically detected. This MVP does not reliably determine whether a later message answered them.</p>
      <div className="message-list">
        {analysis.questions.length ? analysis.questions.map((message) => (
          <article key={message.id} className="message-card">
            <div className="message-header"><div><span className="sender">{message.sender}</span><span className="timestamp">{message.timestamp}</span></div><span className="priority-badge medium">CHECK REPLY</span></div>
            <p className="message-content">{message.text}</p>
            <button type="button" className="context-link" onClick={() => { setContextOpen(message.id); setActiveTab('Priority Inbox') }}>Open original context</button>
          </article>
        )) : <div className="empty-state">No questions detected in this conversation.</div>}
      </div>
    </section>
  )

  const renderRepeatedRequests = () => {
    const repeated = findRepeatedRequests(messages)
    return (
      <section className="panel">
        <div className="panel-header"><h3>Repeated requests</h3></div>
        <p className="panel-subtitle">Keyword overlap suggests these messages may refer to the same request. This is an estimate, not a semantic match.</p>
        {repeated.length ? (
          <div className="repeated-list">
            {repeated.map((pair) => (
              <article className="repeated-item" key={`${pair.first.id}-${pair.second.id}`}>
                <span className="roadmap-label">POSSIBLE MATCH</span>
                <p><strong>{pair.first.sender}:</strong> {pair.first.text}</p>
                <p><strong>{pair.second.sender}:</strong> {pair.second.text}</p>
                <small>Overlapping terms: {pair.shared.join(', ')}</small>
              </article>
            ))}
          </div>
        ) : <div className="empty-state">No similar requests were detected in this conversation.</div>}
      </section>
    )
  }

  const renderTimeline = () => {
    const events = groupMessagesByDate(analysis.rankedMessages
      .filter((message) => message.priority !== 'LOW' || message.type !== 'General'))

    return (
      <section className="panel">
        <div className="panel-header"><h3>Conversation timeline</h3></div>
        <p className="panel-subtitle">Newest dates first, with higher-priority events first within each date. Select an event to open its nearby context.</p>
        <div className="timeline-list">
          {events.length ? events.map((group) => (
            <section className="dated-message-group" key={group.key}>
              <h4 className="date-divider">{group.label}</h4>
              {group.messages.map((message) => (
                <button className="timeline-event" type="button" key={message.id} onClick={() => { setContextOpen(message.id); setActiveTab('Priority Inbox') }}>
                  <span className={`timeline-marker ${message.priority.toLowerCase()}`} />
                  <span className="timeline-content"><small>{getMessageTime(message.timestamp)} · {message.type}</small><strong>{message.sender}</strong><span>{message.text}</span></span>
                  <span className={`priority-badge ${message.priority.toLowerCase()}`}>{message.priority}</span>
                </button>
              ))}
            </section>
          )) : <div className="empty-state">Analyze a conversation to build its timeline.</div>}
        </div>
      </section>
    )
  }

  const renderSmartSearch = () => {
    const searchResults = prioritySourceMessages.filter((message) => {
      const query = searchText.trim().toLowerCase()
      const matchesText = !query || `${message.sender} ${message.text} ${message.timestamp}`.toLowerCase().includes(query)
      const matchesPriority = filters.priority === 'All' || message.priority === filters.priority
      const matchesType = filters.type === 'All' || message.type === filters.type
      return matchesText && matchesPriority && matchesType
    })

    return (
      <section className="panel">
        <div className="panel-header"><h3>Smart Search</h3></div>
        <p className="panel-subtitle">Search this selected conversation locally by message text, sender, timestamp, or priority.</p>
        <div className="search-tools">
          <input className="search-input" value={searchText} onChange={(event) => { setVisibleMessageCount(50); setSearchText(event.target.value) }} placeholder="Try “budget”, “Rahul”, or “Friday”…" aria-label="Search conversation" />
          <select value={filters.priority} onChange={(event) => { setVisibleMessageCount(50); setFilters((current) => ({ ...current, priority: event.target.value })) }}>
            <option value="All">All priorities</option><option value="HIGH">HIGH</option><option value="MEDIUM">MEDIUM</option><option value="LOW">LOW</option>
          </select>
          <select value={filters.type} onChange={(event) => { setVisibleMessageCount(50); setFilters((current) => ({ ...current, type: event.target.value })) }}>
            <option value="All">All categories</option>{typeOptions.filter((type) => type !== 'All').map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="message-list">
          {searchResults.length ? searchResults.map((message) => <article key={message.id} className={`message-card priority-${message.priority.toLowerCase()}`}><div className="message-header"><span className="sender">{message.sender}</span><span className={`priority-badge ${message.priority.toLowerCase()}`}>{message.priority}</span></div><p className="message-content">{message.text}</p></article>) : <div className="empty-state">No messages match the current search.</div>}
        </div>
      </section>
    )
  }

  const renderSettings = () => (
    <section className="panel">
      <div className="panel-header"><h3>Settings</h3></div>
      <label className="settings-field">Name or nickname for mention detection<input value={userName} onChange={(event) => setUserName(event.target.value)} placeholder="For example, Alex" /></label>
      <p className="panel-subtitle">Used only for local, approximate mention matching during this session. It is not saved after the page is closed.</p>
      <button type="button" className="danger-button" onClick={() => setResetOpen(true)}>Clear all chat data</button>
    </section>
  )

  const renderActionItems = () => (
    <section className="panel">
      <div className="panel-header"><h3>Action items</h3></div>
      <div className="task-list">
        {analysis.actions.length ? analysis.actions.map((task) => (
          <div key={task.id} className={`task-card ${taskState[task.id] ? 'done' : ''}`}>
            <label>
              <input type="checkbox" checked={!!taskState[task.id]} onChange={() => toggleTask(task.id)} />
              <span>{task.description}</span>
            </label>
            <div className="task-meta">
              <span>Assigned: {task.assigned}</span>
              <span>Deadline: {task.deadline}</span>
              <span>Sent: {task.timestamp || 'Date not included'}</span>
              <span>Priority: {task.priority}</span>
            </div>
            <small>Source: {task.source}</small>
          </div>
        )) : <div className="empty-state">No explicit action requests found yet.</div>}
      </div>
    </section>
  )

  const renderDecisions = () => (
    <section className="panel">
      <div className="panel-header"><h3>Decisions and meeting updates</h3></div>
      <div className="decision-list">
        {analysis.decisions.length ? analysis.decisions.map((decision) => (
          <div key={decision.id} className="decision-card">
            <strong>{decision.title}</strong>
            <p>{decision.detail}</p>
            <small>{decision.sender} · {decision.time}</small>
          </div>
        )) : <div className="empty-state">No decisions or meeting updates detected.</div>}
      </div>
    </section>
  )

  const renderDeadlines = () => (
    <section className="panel">
      <div className="panel-header"><h3>Deadlines</h3></div>
      <div className="deadline-list">
        {analysis.deadlines.length ? analysis.deadlines.map((deadline, index) => (
          <div key={`${deadline.id ?? deadline.text}-${index}`} className="deadline-card">
            <strong>{detectDeadline(deadline.text) || 'Deadline named'}</strong>
            <p>{deadline.text}</p>
            <small>{deadline.sender} · {deadline.timestamp}</small>
          </div>
        )) : <div className="empty-state">No explicit deadlines detected.</div>}
      </div>
    </section>
  )

  const renderPrivacyCenter = () => (
    <section className="panel privacy-panel">
      <div className="panel-header"><h3>Privacy Center</h3></div>
      <div className="privacy-grid">
        <div><span>Processing location</span><strong>This browser</strong></div>
        <div><span>External chat uploads</span><strong>None</strong></div>
        <div><span>Persistent chat storage</span><strong>Disabled</strong></div>
        <div><span>Analytics and third-party tracking</span><strong>Not used</strong></div>
        <div><span>Current session status</span><strong>{conversations.length ? 'Active' : 'Empty workspace'}</strong></div>
        <div><span>Messages currently loaded</span><strong>{conversations.reduce((total, conversation) => total + conversation.messages.length, 0)}</strong></div>
      </div>
      <button className="danger-button" type="button" onClick={() => setResetOpen(true)}>Delete All Chat Data</button>
      <p className="privacy-note">In-memory chat data is cleared immediately when reset. This app stores nothing in localStorage, IndexedDB, cookies, or remote services.</p>
    </section>
  )

  const renderPanel = () => {
    if (activeTab === 'Overview') return renderOverview()
    if (activeTab === 'All Conversations') return renderAllConversations()
    if (activeTab === 'Priority Inbox') return renderImportantMessages()
    if (activeTab === 'Mentions') return renderMentions()
    if (activeTab === 'Action Items') return renderActionItems()
    if (activeTab === 'Deadlines') return renderDeadlines()
    if (activeTab === 'Decisions') return renderDecisions()
    if (activeTab === 'Questions') return renderQuestions()
    if (activeTab === 'Repeated Requests') return renderRepeatedRequests()
    if (activeTab === 'Timeline') return renderTimeline()
    if (activeTab === 'Smart Search') return renderSmartSearch()
    if (activeTab === 'Settings') return renderSettings()
    return renderPrivacyCenter()
  }

  if (!showDashboard) {
    return (
      <div className="home-page">
        <header className="home-header">
          <div className="brand-wrap">
            <div className="brand-mark">C</div>
            <div>
              <div className="brand-name">ChatCompress</div>
              <div className="tagline">Less scrolling. More understanding.</div>
            </div>
          </div>
          <div className="privacy-badge">PRIVATE MODE ON — Your conversations are processed in this browser. Chat content is never uploaded by this application.</div>
        </header>

        <main className="home-main">
          <section className="home-hero">
            <div className="hero-copy">
              <p className="eyebrow">Your conversation, made clear</p>
              <h1>Catch up on the messages that matter.</h1>
              <p className="hero-text">
                Turn a long chat export into a focused recap of key updates, decisions, deadlines, and next steps.
              </p>
              <div className="hero-actions">
                <button type="button" className="primary-button" onClick={() => setShowDashboard(true)}>Open your dashboard</button>
                <button type="button" className="secondary-button" onClick={loadDemo}>Try the demo</button>
              </div>
              <p className="home-import-note">Start with a chat export or paste messages into your private workspace.</p>
            </div>
            <div className="home-preview" aria-label="Example conversation insights">
              <div className="preview-topline"><span>YOUR 10-SECOND CATCH-UP</span><span className="preview-status">FICTIONAL DEMO</span></div>
              <div className="preview-insight">
                <span className="preview-icon violet">↗</span>
                <div><small>DECISION</small><strong>{landingPreview.decisions[0]?.detail || 'No decision found in demo'}</strong></div>
              </div>
              <div className="preview-insight">
                <span className="preview-icon amber">!</span>
                <div><small>NEEDS YOUR ATTENTION</small><strong>{landingPreview.importantMessages[0]?.text || 'No priority message found in demo'}</strong></div>
              </div>
              <div className="preview-insight">
                <span className="preview-icon green">✓</span>
                <div><small>NEXT STEP</small><strong>{landingPreview.actions[0]?.description || 'No action item found in demo'}</strong></div>
              </div>
              <p>Generated by the same local analysis pipeline using fictional demonstration messages.</p>
            </div>
          </section>

          <section className="home-features" aria-label="How ChatCompress helps">
            <article className="home-feature">
              <span className="feature-number">01</span>
              <h2>Smart catch-up</h2>
              <p>See the important updates and decisions without rereading every message.</p>
            </article>
            <article className="home-feature">
              <span className="feature-number">02</span>
              <h2>Clear next steps</h2>
              <p>Surface likely requests, deadlines, and follow-ups for you to verify.</p>
            </article>
            <article className="home-feature">
              <span className="feature-number">03</span>
              <h2>Private by design</h2>
              <p>Analysis runs in this browser. Your chat is not sent to an AI service.</p>
            </article>
          </section>
          <footer className="home-footer">ChatCompress · Local, rule-based analysis · No account linking required</footer>
        </main>
      </div>
    )
  }

  if (!workspaceReady) {
    return (
      <div className="home-page start-page">
        <header className="home-header">
          <div className="brand-wrap">
            <div className="brand-mark">C</div>
            <div>
              <div className="brand-name">ChatCompress</div>
              <div className="tagline">Less scrolling. More understanding.</div>
            </div>
          </div>
          <button type="button" className="clear-button" onClick={() => setShowDashboard(false)}>Back to home</button>
        </header>

        <main className="start-main">
          <div className="announcement-ticker" aria-label="Private, local conversation analysis">
            <span>✦ &nbsp; PRIVATE CHAT CATCH-UP</span><i>•</i><span>YOUR CHATS STAY IN THIS BROWSER</span><i>•</i><span>NO ACCOUNT LINKING REQUIRED</span>
          </div>
          <section className="start-heading">
            <p className="eyebrow">YOUR WORKSPACE STARTS HERE</p>
            <h1>How would you like to begin?</h1>
            <p>Choose a path to bring the conversations that matter into focus.</p>
          </section>

          <section className="start-options single-option" aria-label="Start with a conversation">
            <article className="start-option import-option">
              <span className="option-number" aria-hidden="true">01</span>
              <span className="option-icon" aria-hidden="true">↑</span>
              <span className="roadmap-label available">READY TO USE</span>
              <h2>Import a conversation</h2>
              <p>Paste chat text or choose a WhatsApp .txt export or .zip archive. Preview the messages, then run the local catch-up analysis.</p>
              <button type="button" className="primary-button" onClick={() => { setWorkspaceReady(true); setActiveTab('Overview') }}>
                Import my chat <span aria-hidden="true">→</span>
              </button>
              <small>Your chat is analyzed locally and is not uploaded.</small>
            </article>
          </section>
          <p className="start-footnote">Want to explore first? <button type="button" className="text-button" onClick={loadDemo}>Open the fictional demo</button></p>
        </main>
      </div>
    )
  }

  return (
    <div className={`page-shell${lightTheme ? ' theme-light' : ''}`}>
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-name">ChatCompress</div>
            <div className="tagline">Less scrolling. More understanding.</div>
          </div>
        </div>

        <div className="dashboard-header-actions">
          <div className="privacy-badge" title="Your chats never leave this browser">
            <span aria-hidden="true">▣</span>
            PRIVATE MODE ON — Your conversations are processed in this browser. Chat content is never uploaded by this application.
          </div>
          <button type="button" className="clear-button theme-toggle" onClick={() => setLightTheme((value) => !value)} aria-label={`Switch to ${lightTheme ? 'dark' : 'light'} theme`}>
            <span aria-hidden="true">{lightTheme ? '☾' : '☼'}</span> {lightTheme ? 'Dark' : 'Light'}
          </button>
          <button type="button" className="clear-button" onClick={() => setShowDashboard(false)}>Back to home</button>
        </div>
      </header>

      <main className="dashboard-shell">
        <div className="dashboard-title">
          <div>
            <p className="eyebrow">PRIVATE WORKSPACE</p>
            <h1>Your conversation dashboard</h1>
            <p>Import a chat export to get a local catch-up summary and follow-up list.</p>
          </div>
        </div>
        <div className="workspace">
          <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
            <div className="sidebar-heading">
              <p className="sidebar-label">WORKSPACE</p>
              <button className="sidebar-collapse-button" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expand workspace navigation' : 'Collapse workspace navigation'} title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>
                {sidebarCollapsed ? '›' : '‹'}
              </button>
            </div>
            <nav>
              {navItems.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  className={activeTab === item ? 'nav-item active' : 'nav-item'}
                  onClick={() => setActiveTab(item)}
                  aria-current={activeTab === item ? 'page' : undefined}
                >
                  <span className="nav-symbol" aria-hidden="true">{['⌂', '▤', '✦', '@', '✓', '◷', '◇', '?', '↻', '⋯', '⌕', 'i', '⚙'][index]}</span>
                  <span className="nav-label">{item}</span>
                  {item === 'All Conversations' && conversations.length > 0 && <span className="nav-count">{conversations.length}</span>}
                  {item === 'Priority Inbox' && highPriorityCount > 0 && <span className="nav-count">{highPriorityCount}</span>}
                  {item === 'Action Items' && analysis.actions.length > 0 && <span className="nav-count">{analysis.actions.length}</span>}
                </button>
              ))}
            </nav>
            <div className="sidebar-footnote">
              <span className="sidebar-status-dot" />
              <span>Local analysis is on</span>
            </div>
            <button className="sidebar-import-button" type="button" onClick={() => document.getElementById('conversation-input')?.focus()}>
              <span aria-hidden="true">+</span> Import conversation
            </button>
          </aside>

          <aside className="conversation-inbox">
            <div className="inbox-heading">
              <div><strong>Conversations</strong><span>{conversations.length} in this session</span></div>
              <button type="button" aria-label="Import conversation" onClick={() => document.getElementById('conversation-input')?.focus()}>+</button>
            </div>
            <input className="search-input" value={conversationSearch} onChange={(event) => setConversationSearch(event.target.value)} placeholder="Search chats…" aria-label="Search conversations" />
            <div className="inbox-conversation-list">
              {conversations.filter((conversation) => `${conversation.name} ${conversation.source}`.toLowerCase().includes(conversationSearch.trim().toLowerCase())).map((conversation) => {
                const attentionCount = conversation.messages.filter((message) => message.priority !== 'LOW' && !reviewedIds.includes(message.id)).length
                return (
                  <button key={conversation.id} type="button" className={`inbox-conversation ${selectedConversationId === conversation.id ? 'selected' : ''}`} onClick={() => selectConversation(conversation)}>
                    <span className="conversation-avatar">{conversation.name.slice(0, 1).toUpperCase()}</span>
                    <span className="inbox-conversation-copy">
                      <span><strong>{conversation.name}</strong><small>{conversation.updatedAt}</small></span>
                      <small>{conversation.messages.at(-1)?.text || 'No message preview'}</small>
                      <span className="inbox-conversation-meta"><span>WhatsApp export · {conversation.messages.length} messages</span>{attentionCount > 0 && <b>{attentionCount} to review</b>}</span>
                    </span>
                  </button>
                )
              })}
              {!conversations.length && (
                <div className="inbox-empty">
                  <span className="empty-chat-icon">✦</span>
                  <strong>Your inbox is empty</strong>
                  <span>Import an export or explore the demo conversation.</span>
                  <button type="button" className="text-button" onClick={loadDemo}>Explore demo</button>
                </div>
              )}
            </div>
            <div className="inbox-footer">Chats stay in memory for this session.</div>
          </aside>

          <section className="main-panel">
            <div className="import-panel panel">
              <div className="panel-header row">
                <h3>Conversation import</h3>
                <button type="button" className="clear-button" onClick={() => setResetOpen(true)}>Reset workspace</button>
              </div>

              <div className="import-grid">
                <div className="textarea-wrap">
                  <div className={`chat-preview-terminal${inputExpanded ? ' expanded' : ''}`}>
                    <div className="terminal-topline">
                      <span className="terminal-dots" aria-hidden="true"><i /><i /><i /></span>
                      <span>LOCAL CHAT PREVIEW</span>
                      {fileSize && <span className="file-size-chip">{fileSize}</span>}
                    </div>
                    <pre className="chat-preview-text">{inputText ? inputPreview : 'Paste a WhatsApp chat export or choose a .txt / .zip file to preview it here.'}</pre>
                    {inputPreviewHasMore && !inputExpanded && <span className="preview-fade" aria-hidden="true" />}
                  </div>
                  <div className="editor-actions">
                    <button type="button" className="text-button" aria-expanded={inputExpanded} aria-controls="conversation-input" onClick={() => setInputExpanded((value) => !value)}>
                      {inputExpanded ? 'Hide full text' : inputText ? 'Show full text' : 'Paste or edit chat'}
                    </button>
                    {fileName && <span className="loaded-file-chip"><span aria-hidden="true">✓</span> {fileName}{fileName.toLowerCase().endsWith('.zip') ? ' · chat text extracted' : ''}{fileSize ? ` · ${fileSize}` : ''}</span>}
                  </div>
                  <textarea
                    id="conversation-input"
                    hidden={!inputExpanded}
                    value={inputText}
                    onChange={(event) => {
                      const value = event.target.value
                      setInputText(value)
                      setFileName('')
                      setFileSize('')
                      setPreviewCount(0)
                      setPreviewPending(Boolean(value.trim()))
                    }}
                    placeholder="Paste a WhatsApp chat export or a copied conversation here..."
                    aria-label="Conversation text"
                  />
                  <div className="helper-row">
                    <span>
                      {previewPending
                        ? 'Checking messages…'
                        : previewCount
                          ? `${previewCount} parsed messages ready`
                          : inputText
                            ? 'No messages detected yet'
                            : 'No chat loaded'}
                    </span>
                    <div className="helper-actions">
                      <button type="button" className="text-button" onClick={loadDemo}>Use demo data</button>
                      {inputText && <button type="button" className="text-button" onClick={cancelImport}>Cancel</button>}
                    </div>
                  </div>
                </div>

                <div className="import-actions">
                  <button type="button" className="primary-button catchup-button" onClick={handleAnalyze}>Catch Me Up <span aria-hidden="true">→</span></button>
                  <label className="upload-box" onDrop={handleFileDrop} onDragOver={(event) => event.preventDefault()}>
                    <span className="upload-symbol" aria-hidden="true">↑</span>
                    <span>Drop a .txt or .zip export here or choose a file</span>
                    <input key={fileInputKey} type="file" accept=".txt,.zip,text/plain,application/zip,application/x-zip-compressed" onChange={handleFileUpload} />
                  </label>
                  <div className="privacy-brief">Files are read and ZIP archives extracted in your browser; chat data is never uploaded. Local rule-based analysis runs on this device.</div>
                </div>
              </div>

              {analysisError && <div className="alert-box">{analysisError}</div>}
            </div>

            {messages.length ? (
              <>
                <section className="stats-grid">
                  <div className="stat-card">
                    <span>Messages</span>
                    <strong>{messages.length}</strong>
                  </div>
                  <button type="button" className="stat-card stat-card-button" onClick={showHighPriorityMessages} aria-label={`Show ${highPriorityCount} high-priority messages`}>
                    <span>High priority</span>
                    <strong>{analysis.rankedMessages.filter((message) => message.priority === 'HIGH').length}</strong>
                    <small>View messages →</small>
                  </button>
                  <div className="stat-card">
                    <span>Outstanding follow-ups</span>
                    <strong>{remainingPriorityCount}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Action items</span>
                    <strong>{analysis.actions.length}</strong>
                  </div>
                </section>

                {renderPanel()}
              </>
            ) : (
              <div className="empty-workspace panel">
                <h3>No conversation analyzed yet</h3>
                <p>Paste a chat export or upload a WhatsApp .txt or .zip file to begin the on-device catch-up scan.</p>
              </div>
            )}
          </section>
        </div>
      </main>
      {commandOpen && (
        <div className="modal-backdrop palette-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false) }}>
          <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title">
            <label id="command-title" htmlFor="command-input">Jump to a section or search messages</label>
            <input
              id="command-input"
              autoFocus
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && commandQuery.trim()) {
                  const exactTab = navItems.find((item) => item.toLowerCase() === commandQuery.trim().toLowerCase())
                  executePaletteCommand(exactTab || commandQuery.trim())
                }
              }}
              placeholder="Type a section or search term…"
            />
            <div className="command-list">
              {navItems
                .filter((item) => item.toLowerCase().includes(commandQuery.toLowerCase()))
                .slice(0, 7)
                .map((item) => (
                  <button key={item} type="button" onClick={() => executePaletteCommand(item)}>
                    <span aria-hidden="true">⌕</span>{item}<kbd>↵</kbd>
                  </button>
                ))}
              {commandQuery.trim() && (
                <button type="button" onClick={() => executePaletteCommand(commandQuery.trim())}>
                  <span aria-hidden="true">⌕</span>Search messages for “{commandQuery.trim()}”<kbd>↵</kbd>
                </button>
              )}
              {!navItems.some((item) => item.toLowerCase().includes(commandQuery.toLowerCase())) && !commandQuery.trim() && <p>Start typing to find a dashboard section.</p>}
            </div>
            <small>Press Esc to close · Ctrl/⌘ K to open</small>
          </section>
        </div>
      )}
      {resetOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setResetOpen(false) }}>
          <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
            <span className="modal-icon" aria-hidden="true">!</span>
            <h2 id="reset-title">Reset this workspace?</h2>
            <p>This clears the conversations currently held in this browser tab. This cannot be undone.</p>
            <div>
              <button type="button" className="clear-button" onClick={() => setResetOpen(false)}>Keep my chats</button>
              <button type="button" className="danger-button" onClick={() => { clearAllChatData(); setResetOpen(false); setToast('Workspace reset') }}>Reset workspace</button>
            </div>
          </section>
        </div>
      )}
      {toast && <div className="toast-message" role="status" aria-live="polite"><span aria-hidden="true">✓</span>{toast}</div>}
    </div>
  )
}

export default App
