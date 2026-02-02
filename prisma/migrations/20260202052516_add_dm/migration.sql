-- CreateTable
CREATE TABLE "DMRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requester_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DMRequest_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DMRequest_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DMConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "initiator_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "DMConversation_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DMConversation_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DMMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "needs_human_input" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DMMessage_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "DMConversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DMMessage_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DMRequest_requester_id_recipient_id_key" ON "DMRequest"("requester_id", "recipient_id");
