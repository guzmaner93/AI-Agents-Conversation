"use server"

export async function startConversation({
  agent1Persona,
  agent2Persona,
  theme,
}: {
  agent1Persona: string
  agent2Persona: string
  theme: string
}) {
  console.log("Server action called with:", { agent1Persona, agent2Persona, theme })

  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      console.error("GOOGLE_API_KEY is not set")
      throw new Error("API key is not configured")
    }

    console.log("API key is available:", apiKey.substring(0, 3) + "..." + apiKey.substring(apiKey.length - 3))

    const initialMessage = {
      agent: 1,
      message: "Hello! I'm ready to start our conversation about " + theme,
    }
    console.log("Created mock initial message to get started")

    const stream = new ReadableStream({
      async start(controller) {
        console.log("Stream started")

        try {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(initialMessage)))
          console.log("Initial message sent to stream")

          let currentAgent = 2
          const previousMessages = [initialMessage.message]
          let turnCount = 1

          while (turnCount < 7) {
            console.log(`Turn ${turnCount}: Agent ${currentAgent} responding`)
            const agentPersona = currentAgent === 1 ? agent1Persona : agent2Persona

            try {
              const response = await getAgentResponse(agentPersona, theme, previousMessages, apiKey)

              // Verificar si la respuesta es vacía
              if (!response.trim()) {
                console.warn("Received empty response. Ending conversation.");
                controller.enqueue(
                  new TextEncoder().encode(
                    JSON.stringify({
                      agent: currentAgent,
                      message: "(The model is silent for now, try again later.)",
                    })
                  )
                );
                break; // Termina la conversación si se recibe una respuesta vacía
              }

              console.log(`Agent ${currentAgent} response:`, response)

              const messageData = {
                agent: currentAgent,
                message: response,
              }

              controller.enqueue(new TextEncoder().encode(JSON.stringify(messageData)))
              console.log(`Message from Agent ${currentAgent} sent to stream`)

              previousMessages.push(response)
              currentAgent = currentAgent === 1 ? 2 : 1
              turnCount++

              await new Promise((resolve) => setTimeout(resolve, 1000))
            } catch (error) {
              console.error(`Error in turn ${turnCount}:`, error)
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    agent: currentAgent,
                    message: `[Error generating response: ${error instanceof Error ? error.message : String(error)}]`,
                  })
                )
              )
              break
            }
          }
        } catch (error) {
          console.error("Error in conversation stream:", error)
          controller.enqueue(
            new TextEncoder().encode(
              JSON.stringify({
                agent: 0,
                message: `[Stream error: ${error instanceof Error ? error.message : String(error)}]`,
              })
            )
          )
        } finally {
          console.log("Stream closing")
          controller.close()
        }
      },
    })

    return {
      stream,
      initialMessage,
    }
  } catch (error) {
    console.error("Error in startConversation:", error)
    throw error
  }
}

async function getAgentResponse(
  persona: string,
  theme: string,
  previousMessages: string[],
  apiKey: string,
): Promise<string> {
  console.log("getAgentResponse called with:", {
    persona: persona.substring(0, 20) + "...",
    theme,
    previousMessagesCount: previousMessages.length,
  })

  const conversationContext =
    previousMessages.length > 0
      ? `Previous messages in the conversation:\n${previousMessages.join("\n")}`
      : "This is the start of the conversation."

  try {
    console.log("Preparing to call Gemini API")

    // Using API key in the URL for simplicity
    const endpoint = `${process.env.NEXT_PUBLIC_BASE_URL}/api/gemini`
    console.log("Gemini API endpoint:", endpoint)

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${persona}\n\nYou are participating in a conversation about: ${theme}\n\n${conversationContext}\n\nBased on the conversation so far and your persona, provide your next response about the theme: ${theme}\n\nKeep your response concise (1-3 sentences).`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Gemini API error:", response.status, errorText)
      throw new Error(`Gemini API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log("Gemini API raw response:", JSON.stringify(data).substring(0, 200) + "...")

    let responseText = ""
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
      responseText = data.candidates[0].content.parts[0].text || ""
    } else {
      responseText = "Unable to generate a response from the API"
    }

    // Verificar si la respuesta es vacía y agregar un mensaje alternativo
    if (!responseText.trim()) {
      console.warn("Received empty response from the API.");
      responseText = "(The model is silent for now, try again later.)";
    }

    console.log("Processed response:", responseText.substring(0, 50) + "...")
    return responseText
  } catch (error) {
    console.error("Error calling Gemini API:", error)
    return `Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
