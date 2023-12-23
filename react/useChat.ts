import { useState, ChangeEvent, FormEvent, useEffect } from "react"
import { fetchEventSource } from "@microsoft/fetch-event-source"
import { Message } from "ai"

import { injectContext } from "@/lib/context"

interface ChatProps {
  api: string,
  initialMessages?: Message[],
  body: {
    [k: string]: any,
  },
  headers: any,
  callbackFn?: () => void,
}

export function useChat({
  api,
  callbackFn,
  headers,
  initialMessages,
  body
}: ChatProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])

  // Add new message to state
  const setUserMessage = (newMessage: Message) => {
    setMessages(prev => [...prev, newMessage])
  }

  const handleNewMessage = (content: string) => {
    const newUserMessage: Message = {
      id: `${Math.random() * 10000}`,
      role: "user",
      content: content,
    }
    const updatedHistory = [...messages, newUserMessage]
    setUserMessage(newUserMessage)
    return updatedHistory
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    setIsLoading(true)

    const messageHistory = handleNewMessage(input)
    const messageHistoryCloned = messageHistory.slice()
    if (body.fileRecords) {
      await injectContext(
        body.userId,
        messageHistory,
        body.fileRecords,
      )
    }
    
    setInput("")

    let fullResponse = ""

    fetchEventSource(api, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: messageHistory.map(m => ({
          role: m.role,
          content: m.content,
        })),
        // ...body,
      }),
      async onopen() {
      },
      onmessage(msg) {
        const { data } = msg
        if (data.includes("[DONE]")) {
          return
        }
        const cloudFunctionResponse: {
          id: string;
          data: string;
        } = JSON.parse(data)

        fullResponse += cloudFunctionResponse.data
        fullResponse.trim()

        const incomingMessage: Message = {
          id: cloudFunctionResponse.id,
          role: "assistant",
          content: fullResponse,
        }
        setMessages([...messageHistoryCloned, incomingMessage])
      },
      onclose() {
        setIsLoading(false)
        if (callbackFn) {
          callbackFn()
        }
      }
    })
  }

  useEffect(() => {
    if (initialMessages && initialMessages.length) {
      setMessages(initialMessages)
    }
  }, [])

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
  }
}

