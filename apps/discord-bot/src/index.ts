import { createClient } from "@supabase/supabase-js"
import {
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  type Guild,
  type GuildMember,
  type PartialGuildMember
} from "discord.js"

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

const discordToken = requiredEnvironment("DISCORD_BOT_TOKEN")
const discordGuildId = requiredEnvironment("DISCORD_GUILD_ID")
const supabaseUrl = requiredEnvironment("SUPABASE_URL")
const supabaseServiceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY")
const requestedSyncMinutes = Number(
  process.env.DISCORD_SYNC_INTERVAL_MINUTES || "360"
)
const syncIntervalMinutes =
  Number.isFinite(requestedSyncMinutes) && requestedSyncMinutes >= 15
    ? requestedSyncMinutes
    : 360

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
})

let reconciliationInProgress = false

function roleIds(member: GuildMember): string[] {
  return member.roles.cache
    .filter((role) => role.id !== member.guild.id)
    .map((role) => role.id)
}

async function saveMember(member: GuildMember): Promise<void> {
  if (member.guild.id !== discordGuildId) return

  const { error } = await supabase
    .from("discord_memberships")
    .update({
      discord_roles: roleIds(member),
      is_member: !member.pending,
      verified_at: new Date().toISOString(),
      verification_source: "bot"
    })
    .eq("guild_id", discordGuildId)
    .eq("discord_user_id", member.id)

  if (error) {
    console.error(`Unable to synchronize Discord member ${member.id}`, error)
  }
}

async function removeMember(
  member: GuildMember | PartialGuildMember
): Promise<void> {
  if (member.guild.id !== discordGuildId) return

  const { error } = await supabase
    .from("discord_memberships")
    .update({
      discord_roles: [],
      is_member: false,
      verified_at: new Date().toISOString(),
      verification_source: "bot"
    })
    .eq("guild_id", discordGuildId)
    .eq("discord_user_id", member.id)

  if (error) {
    console.error(`Unable to revoke Discord member ${member.id}`, error)
  }
}

function isUnknownMember(error: unknown): boolean {
  return error instanceof DiscordAPIError && error.code === 10007
}

async function reconcileMemberships(guild: Guild): Promise<void> {
  if (reconciliationInProgress) return
  reconciliationInProgress = true

  try {
    const { data: memberships, error } = await supabase
      .from("discord_memberships")
      .select("discord_user_id")
      .eq("guild_id", discordGuildId)

    if (error) {
      console.error("Unable to load Discord memberships for reconciliation", error)
      return
    }

    for (const membership of memberships || []) {
      try {
        const member = await guild.members.fetch(membership.discord_user_id)
        await saveMember(member)
      } catch (memberError) {
        if (isUnknownMember(memberError)) {
          const { error: revokeError } = await supabase
            .from("discord_memberships")
            .update({
              discord_roles: [],
              is_member: false,
              verified_at: new Date().toISOString(),
              verification_source: "bot"
            })
            .eq("guild_id", discordGuildId)
            .eq("discord_user_id", membership.discord_user_id)

          if (revokeError) {
            console.error(
              `Unable to revoke missing Discord member ${membership.discord_user_id}`,
              revokeError
            )
          }
          continue
        }

        console.error(
          `Unable to fetch Discord member ${membership.discord_user_id}`,
          memberError
        )
      }
    }

    console.log(`Reconciled ${memberships?.length || 0} Discord memberships`)
  } finally {
    reconciliationInProgress = false
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  const guild = await readyClient.guilds.fetch(discordGuildId)
  console.log(`Discord membership bot connected to ${guild.name}`)
  await reconcileMemberships(guild)

  setInterval(
    () => void reconcileMemberships(guild),
    syncIntervalMinutes * 60 * 1000
  ).unref()
})

client.on(Events.GuildMemberAdd, (member) => void saveMember(member))
client.on(Events.GuildMemberUpdate, (_previous, member) => void saveMember(member))
client.on(Events.GuildMemberRemove, (member) => void removeMember(member))
client.on(Events.Error, (error) => console.error("Discord client error", error))

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; disconnecting Discord bot`)
  client.destroy()
  process.exit(0)
}

process.once("SIGINT", () => void shutdown("SIGINT"))
process.once("SIGTERM", () => void shutdown("SIGTERM"))

await client.login(discordToken)
