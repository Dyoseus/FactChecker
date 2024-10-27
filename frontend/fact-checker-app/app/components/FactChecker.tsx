"use client"
import { useEffect, useState, useRef } from "react"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

type FactCheckStatus = "True" | "False" | "Partially True"

interface FactCheck {
  statement: string
  result: FactCheckStatus
  explanation: string
}

const initialFactChecks: FactCheck[] = [
  {
    statement: "The Earth is flat.",
    result: "False",
    explanation: "Numerous scientific observations and measurements have conclusively proven that the Earth is roughly spherical."
  },
  {
    statement: "Vaccines cause autism.",
    result: "False",
    explanation: "Extensive scientific research has found no link between vaccines and autism."
  },
  {
    statement: "Drinking water helps maintain overall health.",
    result: "True",
    explanation: "Proper hydration is essential for various bodily functions and overall well-being."
  },
  {
    statement: "Humans only use 10% of their brains.",
    result: "False",
    explanation: "Brain scans have shown that we use most of our brain, even when we're sleeping."
  },
  {
    statement: "Exercise can improve mental health.",
    result: "True",
    explanation: "Regular physical activity has been shown to reduce symptoms of depression and anxiety."
  },
  {
    statement: "Climate change is partially caused by human activities.",
    result: "Partially True",
    explanation: "While natural factors contribute to climate change, human activities, particularly greenhouse gas emissions, are the dominant cause of observed climate change since the mid-20th century."
  }
]

function getStatusIcon(status: FactCheckStatus) {
  switch (status) {
    case "True":
      return <CheckCircle className="h-6 w-6 text-green-500" />
    case "False":
      return <XCircle className="h-6 w-6 text-red-500" />
    case "Partially True":
      return <AlertCircle className="h-6 w-6 text-yellow-500" />
  }
}

function getStatusColor(status: FactCheckStatus) {
  switch (status) {
    case "True":
      return "bg-green-100 text-green-800"
    case "False":
      return "bg-red-100 text-red-800"
    case "Partially True":
      return "bg-yellow-100 text-yellow-800"
  }
}

export default function FactChecker() {
  const [factChecks, setFactChecks] = useState<FactCheck[]>(initialFactChecks)
  const [wsStatus, setWsStatus] = useState<string>("disconnected")
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    console.log("Attempting to connect to WebSocket...")
    
    const connectWebSocket = () => {
      wsRef.current = new WebSocket('ws://localhost:8000/ws')

      wsRef.current.onopen = () => {
        console.log("WebSocket connected!")
        setWsStatus("connected")
      }

      wsRef.current.onmessage = (event) => {
        console.log("Received message:", event.data)
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'NEW_FACT_CHECK') {
            console.log("Adding new fact check:", data.factCheck)
            setFactChecks(prevChecks => [data.factCheck, ...prevChecks])
          }
        } catch (error) {
          console.error("Error processing message:", error)
        }
      }

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error)
        setWsStatus("error")
      }

      wsRef.current.onclose = () => {
        console.log("WebSocket closed. Attempting to reconnect...")
        setWsStatus("disconnected")
        setTimeout(connectWebSocket, 5000)
      }
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Fact Checker</CardTitle>
        <CardDescription>
          A history of fact-checked statements 
          {/* Add connection status indicator */}
          <span className={`ml-2 px-2 py-1 text-xs rounded ${
            wsStatus === "connected" ? "bg-green-100 text-green-800" :
            wsStatus === "error" ? "bg-red-100 text-red-800" :
            "bg-yellow-100 text-yellow-800"
          }`}>
            {wsStatus}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {factChecks.map((check, index) => (
            <div key={index} className="mb-6 last:mb-0">
              <div className="flex items-start space-x-4">
                <div className="mt-1">{getStatusIcon(check.result)}</div>
                <div className="flex-1">
                  <p className="font-semibold mb-2">{check.statement}</p>
                  <div className={`inline-block px-2 py-1 rounded-full text-sm font-medium mb-2 ${getStatusColor(check.result)}`}>
                    {check.result}
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">{check.explanation}</p>
                </div>
              </div>
              {index < factChecks.length - 1 && <hr className="my-4 border-gray-200 dark:border-gray-700" />}
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}