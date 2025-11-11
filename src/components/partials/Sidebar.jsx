import React from 'react'
import '../../assets/css/sidebar.css'

class Sidebar extends React.Component {
  constructor(props) {
    super(props)
    
    // Load saved rewards from localStorage or use defaults
    const savedRewards = localStorage.getItem('umbraRewards')
    const savedTodayEarnings = localStorage.getItem('umbraTodayEarnings')
    const lastEarningDate = localStorage.getItem('umbraLastEarningDate')
    const today = new Date().toDateString()
    
    // Reset daily earnings if it's a new day
    const todayEarnings = (lastEarningDate === today) ? 
      (savedTodayEarnings ? parseInt(savedTodayEarnings) : 0) : 0
    
    this.state = {
      isCollapsed: false,
      chatMessages: [],
      inputMessage: '',
      umbraRewards: savedRewards ? parseInt(savedRewards) : 2847,
      todayEarnings: todayEarnings,
      isEarning: false,
      sessionStartTime: Date.now(),
      earningInterval: null
    }
  }

  componentDidMount() {
    // Start earning $UMBRA tokens based on browsing time
    this.startEarning()
    
    // Update last earning date
    localStorage.setItem('umbraLastEarningDate', new Date().toDateString())
  }

  componentWillUnmount() {
    if (this.state.earningInterval) {
      clearInterval(this.state.earningInterval)
    }
  }

  startEarning = () => {
    // Earn 1 $UMBRA token every 30 seconds of browsing
    const interval = setInterval(() => {
      this.setState(prevState => {
        const newTotalRewards = prevState.umbraRewards + 1
        const newTodayEarnings = prevState.todayEarnings + 1
        
        // Save to localStorage
        localStorage.setItem('umbraRewards', newTotalRewards.toString())
        localStorage.setItem('umbraTodayEarnings', newTodayEarnings.toString())
        
        return {
          umbraRewards: newTotalRewards,
          todayEarnings: newTodayEarnings,
          isEarning: true
        }
      })
      
      // Show earning notification briefly
      setTimeout(() => {
        this.setState({ isEarning: false })
      }, 1000)
      
    }, 30000) // Every 30 seconds
    
    this.setState({ earningInterval: interval })
  }

  toggleSidebar = () => {
    this.setState({ isCollapsed: !this.state.isCollapsed })
  }

  handleMessageSubmit = (e) => {
    e.preventDefault()
    if (this.state.inputMessage.trim()) {
      const newMessage = {
        id: Date.now(),
        text: this.state.inputMessage,
        isUser: true
      }
      
      this.setState(prevState => ({
        chatMessages: [...prevState.chatMessages, newMessage],
        inputMessage: ''
      }))

      // Simulate AI response
      setTimeout(() => {
        const responses = [
          "I'm here to help with your privacy browsing.",
          "UMBRA keeps your data secure with Tor routing.",
          "You've earned rewards for private browsing!",
          "Would you like tips on maximizing privacy?"
        ]
        const aiMessage = {
          id: Date.now() + 1,
          text: responses[Math.floor(Math.random() * responses.length)],
          isUser: false
        }
        this.setState(prevState => ({
          chatMessages: [...prevState.chatMessages, aiMessage]
        }))
      }, 500)
    }
  }

  getEarningRate = () => {
    const sessionTime = (Date.now() - this.state.sessionStartTime) / 1000 / 60 // minutes
    return Math.round((this.state.todayEarnings / Math.max(sessionTime, 1)) * 60) // per hour
  }

  render() {
    const { isCollapsed, chatMessages, inputMessage, umbraRewards, todayEarnings, isEarning } = this.state

    return (
      <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Sidebar Toggle */}
        <button className="sidebar-toggle" onClick={this.toggleSidebar}>
          {isCollapsed ? '→' : '←'}
        </button>

        {!isCollapsed && (
          <div className="sidebar-content">
            {/* Rewards Section */}
            <div className="sidebar-section">
              <h4 className="section-title">
                $UMBRA Rewards {isEarning && <span className="earning-indicator">+1</span>}
              </h4>
              <div className="rewards-display">
                <div className="reward-item">
                  <span className="reward-number">{umbraRewards.toLocaleString()}</span>
                  <span className="reward-label">Total $UMBRA</span>
                </div>
                <div className="reward-item">
                  <span className="reward-number">+{todayEarnings}</span>
                  <span className="reward-label">Today</span>
                </div>
                <div className="reward-item earning-rate">
                  <span className="reward-number">{this.getEarningRate()}/hr</span>
                  <span className="reward-label">Rate</span>
                </div>
              </div>
              <div className="earning-info">
                <small>💡 Earn 1 $UMBRA every 30 seconds of private browsing</small>
              </div>
            </div>

            {/* Chat Section */}
            <div className="sidebar-section chat-section">
              <h4 className="section-title">AI Assistant</h4>
              
              <div className="chat-messages">
                {chatMessages.length === 0 && (
                  <div className="welcome-message">
                    Ask me anything about ZERO Browser or privacy browsing.
                  </div>
                )}
                {chatMessages.map(message => (
                  <div key={message.id} className={`message ${message.isUser ? 'user' : 'ai'}`}>
                    {message.text}
                  </div>
                ))}
              </div>

              <form onSubmit={this.handleMessageSubmit} className="chat-form">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => this.setState({ inputMessage: e.target.value })}
                  placeholder="Ask UMBRA Assistant..."
                  className="chat-input"
                />
                <button type="submit" className="chat-submit">
                  →
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }
}

export default Sidebar