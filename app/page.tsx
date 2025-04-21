"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Loader2, Play, Square } from "lucide-react"
import { startConversation } from "./actions"

export default function Home() {
  const [agent1Persona, setAgent1Persona] = useState("")
  const [agent2Persona, setAgent2Persona] = useState("")
  const [theme, setTheme] = useState("")
  const [conversation, setConversation] = useState<Array<{ agent: number; message: string }>>([])
  const [isConversing, setIsConversing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const abortRef = useRef(false)
  const skipFirstChunk = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversation])

  const handleStartConversation = async () => {
    if (!agent1Persona || !agent2Persona || !theme) return

    abortRef.current = false
    skipFirstChunk.current = true
    setIsConversing(true)
    setConversation([])
    setError(null)
    setDebugInfo("Starting conversation...")

    try {
      setDebugInfo("Calling startConversation action...")
      const response = await startConversation({ agent1Persona, agent2Persona, theme })
      if (!response) throw new Error("No response from server action")

      const { stream, initialMessage } = response
      setDebugInfo(`Initial message: ${JSON.stringify(initialMessage)}`)
      if (initialMessage) setConversation([{ agent: initialMessage.agent, message: initialMessage.message }])
      if (!stream) throw new Error("No stream returned from server action")

      setDebugInfo("Stream received, reading...")
      const reader = stream.getReader()
      let done = false

      while (!done && !abortRef.current) {
        setDebugInfo("Reading chunk...")
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        if (value) {
          const chunk = new TextDecoder().decode(value)
          setDebugInfo(`Chunk: ${chunk}`)
          try {
            const data = JSON.parse(chunk)
            if (skipFirstChunk.current) {
              skipFirstChunk.current = false
              continue
            }
            if (data.agent && data.message && data.message.trim()) {
              setConversation(prev => [...prev, { agent: data.agent, message: data.message }])
            }
          } catch {}
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(err)
      setError(msg)
    } finally {
      setIsConversing(false)
      setDebugInfo("Conversation ended")
    }
  }

  const stopConversation = () => {
    abortRef.current = true
    setIsConversing(false)
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-center mb-8">AI Agents Conversation</h1>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Setup</CardTitle>
            <CardDescription>Define personas & theme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Agent 1 Persona</Label>
              <Input value={agent1Persona} onChange={e => setAgent1Persona(e.target.value)} placeholder="Example: You are a teacher who loves to explain simple concepts clearly." />
            </div>
            <div className="space-y-2">
              <Label>Agent 2 Persona</Label>
              <Input value={agent2Persona} onChange={e => setAgent2Persona(e.target.value)} placeholder="Example: You are a student who is eager to learn and asks a lot of questions." />
            </div>
            <div className="space-y-2">
              <Label>Theme</Label>
              <Input value={theme} onChange={e => setTheme(e.target.value)} placeholder="Example: The benefits of daily exercise." />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="secondary" onClick={stopConversation} disabled={!isConversing}>
              <Square className="mr-2 h-4 w-4" /> Stop
            </Button>
            <Button onClick={handleStartConversation} disabled={isConversing}>
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <CardContent className="bg-gray-50 rounded-lg p-4 h-[400px] overflow-y-auto">
            {conversation.map((entry, idx) => (
              <div
                key={idx}
                className={`flex ${entry.agent === 1 ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-2xl shadow transition transform duration-300 ease-in-out hover:scale-105 ${
entry.agent === 1 ? "bg-blue-200" : "bg-green-200"}
                  `}
                >
                  <p className="font-semibold mb-1">
                    {entry.agent === 1 ? agent1Persona : agent2Persona}
                  </p>
                  <p className="whitespace-pre-wrap">{entry.message}</p>
                </div>
              </div>
            ))}
            <div ref={scrollRef} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
