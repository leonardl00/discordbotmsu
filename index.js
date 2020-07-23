// Bot declaration and dependencies
const { Client , Util } = require('discord.js');
const Discord = require('discord.js');
const bot = new Client({disableEveryone: true});
const ytdl = require("ytdl-core");
const moment = require('moment');
const cheerio = require("cheerio");
const fs = require("fs");
const request = require("request")
const ms = require('ms')
const YouTube = require('simple-youtube-api')
 
// Music queue array
const queue = new Map()
 
// Bot token and Youtube API
const token = 'NzM0OTYwMjcwODQ1MjgwMjk4.XxZVmQ._8J6A6vrl1rtl-9e8qOTJcjsGbc';
const youtubeapi = 'AIzaSyC4hE3U-kEoYj80LyLPIc5j39FfDvNPCPY'
const youtube = new YouTube(youtubeapi)

// Prefix settings
const PREFIX = 'pls ';

var version = '1.2.0';

var servers = {};

// Start up bot
bot.on('ready', () =>{
    console.log('This bot is online!');
    bot.user.setActivity('pls help');
})

// Welcome new users to server
bot.on('guildMemberAdd', member =>{

    const channel = member.guild.channels.cache.find(channel => channel.name === "general");
    if(!channel) return;

    channel.send(`Welcome to our server, ${member}, enjoy your stay!`);
})
 // Commands REEE
bot.on('message', async message =>{
    //Check if message from bot or has prefix
    if(message.author.bot) return
    if(!message.content.startsWith(PREFIX)) return

    //Prefix initiator and youtube search constants
    const args = message.content.substring(PREFIX.length).split(" ")
    const searchString = args.slice(1).join(' ')
    const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : ''
    const serverQueue = queue.get(message.guild.id)
    const mentionedMember = message.mentions.members.first()
    var parts = message.content.split(" ")

    // Play music command
    if(message.content.startsWith(`${PREFIX}play`)) {
        const voiceChannel = message.member.voice.channel
        if(!voiceChannel) return message.channel.send("You need to be in a voice channel to play music!")
        const permissions = voiceChannel.permissionsFor(message.client.user)
        if(!permissions.has('CONNECT')) return message.channel.send("I don\'t have permissions to connect to the voice channel!")
        if(!permissions.has('SPEAK')) return message.channel.send("I don\'t have permissions to speak in the channel!")

        if(url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)){
            const playlist = await youtube.getPlaylist(url)
            const videos = await playlist.getVideos()
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id)
                await handleVideo(video2, message, voiceChannel, true)
            }
            message.channel.send(`Playlist **${playlist.title}** has been added to the queue`)
        } else {
            try {
                var video = await youtube.getVideo(url)
            } catch {
                try {
                    var videos = await youtube.searchVideos(searchString, 10)
                    var index = 0
                    message.channel.send(`
__**Song Selection:**__
${videos.map(video2 => `**${++index} -**${video2.title}`).join('\n')}

Please select one of the songs ranging from 1-10
                    `)
                    try {
                        var responce = await message.channel.awaitMessages(msg => msg.content > 0 && msg.content << 11, {
                            max: 1,
                            time: 30000,
                            errors: ['time']
                        })
                    } catch {
                        message.channel.send('No or invalid song selection was provided!')
                    }
                    const videoIndex = parseInt(responce.first().content)
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id)
                } catch {
                    return message.channel.send("I couldn\'t find any search results")
                }
            }
            return handleVideo(video, message, voiceChannel)
        }
    // Stop music command
    } else if (message.content.startsWith(`${PREFIX}stop`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to stop the music!")
        if(!serverQueue) return message.channel.send("There is nothing playing!")
        serverQueue.songs = []
        serverQueue.connection.dispatcher.end()
        message.channel.send("I have stopped the music for you!")
        return undefined
    // Skip music command
    } else if (message.content.startsWith(`${PREFIX}skip`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to skip the music!")
        if(!serverQueue) return message.channel.send("There is nothing playing!")
        serverQueue.connection.dispatcher.end()
        message.channel.send("I have skipped the music for you!")
        return undefined
    // Set volume command
    } else if(message.content.startsWith(`${PREFIX}volume`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to use music commands!")
        if(!serverQueue) return message.channel.send("There is nothing playing")
        if(!args[1]) return message.channel.send(`That volume is: **${serverQueue.volume}**`)
        if(isNaN(args[1])) return message.channel.send("That is not a valid amount to change the volume to!")
        serverQueue.volume = args[1]
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1]/5)
        message.channel.send(`I have change the volume to: **${args[1]}**`)
        return undefined
    // Now playing command
    } else if (message.content.startsWith (`${PREFIX}np`)) {
        if(!serverQueue) return message.channel.send("There is nothing playing!")
        message.channel.send(`Now Playing: **${serverQueue.songs[0].title}**`)
        return undefined
    // Queue check command
    } else if (message.content.startsWith (`${PREFIX}queue`)) {
        if(!serverQueue) return message.channel.send("There is nothing playing")
        message.channel.send(`
__**Song Queue:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}

**Now Playing:** ${serverQueue.songs[0].title}
        `, { split: true})
        return undefined
    // Pause music command
    }else if (message.content.startsWith(`${PREFIX}pause`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to use the pause command!")
        if(!serverQueue) return message.channel.send("There is nothing playing!")
        if(!serverQueue.playing) return message.channel.send("The music is already paused!")
        serverQueue.playing = false
        serverQueue.connection.dispatcher.pause()
        message.channel.send("I have now paused the music for you!")
        return undefined
    // Resume music command
    }else if (message.content.startsWith(`${PREFIX}resume`)) {
        if(!message.member.voice.channel) return message.channel.send("You need to be in a voice channel to use the resume command!")
        if(!serverQueue) return message.channel.send("There is nothing playing!")
        if(serverQueue.playing) return message.channel.send("The music is already playing!")
        serverQueue.playing = true
        serverQueue.connection.dispatcher.resume()
        message.channel.send("I have now resumed the music for you!")
        return undefined
    // Help command
    }else if (message.content.startsWith(`${PREFIX}help`)) {
        const helpembed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle('BOT COMMANDS')
        .setURL('https://www.instagram.com/defonotnorm/?hl=en')
        .setAuthor('Ahrourah Bot', 'https://static.vecteezy.com/system/resources/previews/000/606/420/non_2x/letter-a-logo-design-concept-template-vector.jpg', 'https://discord.js.org')
        .setDescription('Please add a \'pls \' prefix before every command.\nCommands included in the bot:')
        .setThumbnail('https://static.vecteezy.com/system/resources/previews/000/606/420/non_2x/letter-a-logo-design-concept-template-vector.jpg')
        .addFields(
            { name: 'Music commands', value: '1️⃣ play - Plays music based on youtube urls or search.\n2️⃣ stop - Stops current playing music and disconnects bot.\n3️⃣ pause - Pauses music.\n4️⃣ resume - Resumes music.\n5️⃣ np - Shows currently playing song.\n6️⃣ queue - Shows current queue of songs.\n7️⃣ volume [1-5] - Adjusts volume within range 1-5.' },
            { name: 'Utility commands', value: '1️⃣ kick - Kick mentioned member.\n2️⃣ ban - Ban mentioned member.\n3️⃣ softban - Softban mentioned member for a day.\n4️⃣ mute - Mute mentioned member for specified time.\n5️⃣ unmute - Unmute mentioned member.\n6️⃣ purge - Bulk delete specified amount of messages.\n7️⃣ image - Google image searches given keyword.'},
            { name: '\u200B', value: '\u200B' },
            { name: 'MSU eKlas webportal', value: 'https://eklas.msu.edu.my/', inline: true },
            { name: 'MSU College Sabah Facebook', value: 'https://web.facebook.com/MSUCsabah/?rf=177739085988044&_rdc=1&_rdr', inline: true },
        )
        .setTimestamp()
        .setFooter('Bot made by Normand & Charles.', 'https://static.vecteezy.com/system/resources/previews/000/606/420/non_2x/letter-a-logo-design-concept-template-vector.jpg');
            message.channel.send(helpembed)
            return undefined
        return undefined
    // Secret uwu
    }else if (message.content.startsWith(`${PREFIX}ping`)){
        message.reply("pong!")
    // Kick members
    }else if (message.content.startsWith(`${PREFIX}kick`)) {
        const reason = args.slice(2).join(" ")
        if(!message.member.hasPermission('KICK_MEMBERS')) return message.channel.send("You don\'t have permission to do this command")
        if(!message.guild.me.hasPermission('KICK_MEMBERS')) return message.channel.send ("I don\'t have permission to kick members")
        if(!args[1]) return message.channel.send("You need to specify someone to kick!")
        if(!mentionedMember) return message.channel.send ("I can\'t find that member!")
        if(mentionedMember.roles.highest.position >= message.member.roles.highest.position && message.author.id !== message.guild.owner.id) {
            return message.channel.send("You can\'t kick this member due to your role being lower than theirs or they're the guild owner")
        }
        if(mentionedMember.id === message.author.id) return message.channel.send("Why would you want to kick yourself lmao?")
        if(mentionedMember.kickable) {
            var kickembed = new Discord.MessageEmbed()
            .setAuthor(`${message.author.username} - (${message.author.id})`, message.author.displayAvatarURL())
            .setThumbnail(mentionedMember.user.displayAvatarURL())
            .setColor('#ebb734')
            .setDescription(`
**Member:** ${mentionedMember.user.username} - (${mentionedMember.user.id})
**Action:** Kick
**Reason:** ${reason || "Undefined"}
**Channel:** ${message.channel}
**Time:** ${moment().format('llll')}
            `)
            message.channel.send(kickembed)
            mentionedMember.kick()
        }else {
            return message.channel.send("I can\'t kick this user! Make sure I have permissions.")
        }
        return undefined
    // Ban members
    } else if(message.content.startsWith(`${PREFIX}ban`)) {
        const reason = args.slice(2).join(" ")
        if(!message.member.hasPermission('BAN_MEMBERS')) return message.channel.send("You don\'t have permission to do this command")
        if(!message.guild.me.hasPermission('BAN_MEMBERS')) return message.channel.send ("I don\'t have permission to ban members")
        if(!args[1]) return message.channel.send("You need to specify someone to ban!")
        if(!mentionedMember) return message.channel.send ("I can\'t find that member!")
        if(mentionedMember.roles.highest.position >= message.member.roles.highest.position && message.author.id !== message.guild.owner.id) {
            return message.channel.send("You can\'t ban this member due to your role being lower than theirs or they're the guild owner")
        }
        if(mentionedMember.id === message.author.id) return message.channel.send("Why would you want to ban yourself lmao?")
        if(mentionedMember.bannable) {
            var banembed = new Discord.MessageEmbed()
            .setAuthor(`${message.author.username} - (${message.author.id})`, message.author.displayAvatarURL())
            .setThumbnail(mentionedMember.user.displayAvatarURL())
            .setColor('#ebb734')
            .setDescription(`
**Member:** ${mentionedMember.user.username} - (${mentionedMember.user.id})
**Action:** Ban
**Reason:** ${reason || "Undefined"}
**Channel:** ${message.channel}
**Time:** ${moment().format('llll')}
            `)
            message.channel.send(banembed)
            mentionedMember.ban()
        }else {
            return message.channel.send("I can\'t ban this user! Make sure I have permissions.")
        }
        return undefined
    // Softban members
    } else if(message.content.startsWith(`${PREFIX}softban`)) {
        const reason = args.slice(2).join(" ")
        if(!message.member.hasPermission('BAN_MEMBERS')) return message.channel.send("You don\'t have permission to do this command")
        if(!message.guild.me.hasPermission('BAN_MEMBERS')) return message.channel.send ("I don\'t have permission to ban members")
        if(!args[1]) return message.channel.send("You need to specify someone to ban!")
        if(!mentionedMember) return message.channel.send ("I can\'t find that member!")
        if(mentionedMember.roles.highest.position >= message.member.roles.highest.position && message.author.id !== message.guild.owner.id) {
            return message.channel.send("You can\'t softban this member due to your role being lower than theirs or they're the guild owner")
        }
        if(mentionedMember.id === message.author.id) return message.channel.send("Why would you want to softban yourself lmao?")
        if(mentionedMember.bannable) {
            var softbanembed = new Discord.MessageEmbed()
            .setAuthor(`${message.author.username} - (${message.author.id})`, message.author.displayAvatarURL())
            .setThumbnail(mentionedMember.user.displayAvatarURL())
            .setColor('#ebb734')
            .setDescription(`
**Member:** ${mentionedMember.user.username} - (${mentionedMember.user.id})
**Action:** Softban
**Reason:** ${reason || "Undefined"}
**Channel:** ${message.channel}
**Time:** ${moment().format('llll')}
            `)
            message.channel.send(softbanembed)
            mentionedMember.ban({days: 1}).then(() => message.guild.members.unban(mentionedMember.id))
        }else {
            return message.channel.send("I can\'t ban this user! Make sure I have permissions.")
        }
        return undefined
    // Mute members
    }else if(message.content.startsWith(`${PREFIX}mute`)) {
        const reason = args.slice(3).join(" ")
        const regex = /\d+[smhdw]/.exec(args[2])
        if(!message.member.hasPermission('KICK_MEMBERS')) return message.channel.send("You don\'t have permission to do this command")
        if(!message.guild.me.hasPermission('MANAGE_ROLES')) return message.channel.send ("I don\'t have permission to mute members")
        if(!args[1]) return message.channel.send("You need to specify someone to mute!")
        if(!mentionedMember) return message.channel.send ("I can\'t find that member!")
        if(!args[2]) return message.channel.send("You need to specify how long you want to mute this user!")
        if(!regex) return message.channel.send("That is not a valid amount of time to mute that member!")
        if(ms(regex[0]) > 214748367) return message.channel.send("Make sure you don\'t mute a member for more than 25 days!")
        if(mentionedMember.roles.highest.position >= message.member.roles.highest.position && message.author.id !== message.guild.owner.id) {
            return message.channel.send("You can\'t mute this member due to your role being lower than theirs or they're the guild owner")
        }
        if(mentionedMember.id === message.author.id) return message.channel.send("Why would you want to mute yourself lmao?")
        if(mentionedMember.kickable) {
            var muteembed = new Discord.MessageEmbed()
            .setAuthor(`${message.author.username} - (${message.author.id})`, message.author.displayAvatarURL())
            .setThumbnail(mentionedMember.user.displayAvatarURL())
            .setColor('#ebb734')
            .setDescription(`
**Member:** ${mentionedMember.user.username} - (${mentionedMember.user.id})
**Action:** Mute
**Reason:** ${reason || "Undefined"}
**Length:** ${regex}
**Channel:** ${message.channel}
**Time:** ${moment().format('llll')}
            `)
            message.channel.send(muteembed)
            if (!mentionedMember.roles.cache.has('735457717354758336')) return message.channel.send("This member is already muted!")
            mentionedMember.roles.add('735457717354758336')
            setTimeout(() => {
                if (!mentionedMember.roles.cache.has('735457717354758336')) return undefined
                mentionedMember.roles.remove('735457717354758336')
                message.channel.send(`${mentionedMember} has now been unmuted after ${regex[0]}`)
            }, ms(regex[0]))
        }else {
            return message.channel.send("I can\'t mute this user! Make sure I have permissions.")
        }
        return undefined
    // Unmute members
    }else if(message.content.startsWith(`${PREFIX}unmute`)) {
        const reason = args.slice(2).join(" ")
        if(!message.member.hasPermission('KICK_MEMBERS')) return message.channel.send("You don\'t have permission to do this command")
        if(!message.guild.me.hasPermission('MANAGE_ROLES')) return message.channel.send ("I don\'t have permission to unmute members")
        if(!args[1]) return message.channel.send("You need to specify someone to unmute!")
        if(!mentionedMember) return message.channel.send ("I can\'t find that member!")
        if(mentionedMember.roles.highest.position >= message.member.roles.highest.position && message.author.id !== message.guild.owner.id) {
            return message.channel.send("You can\'t mute this member due to your role being lower than theirs or they're the guild owner")
        }
        if(mentionedMember.id === message.author.id) return message.channel.send("Nice try... You can\'t unmute your self")
        if(!mentionedMember.roles.cache.has('735457717354758336')) return message.channel.send("This member is not muted!")
        var unmuteembed = new Discord.MessageEmbed()
        .setAuthor(`${message.author.username} - (${message.author.id})`, message.author.displayAvatarURL())
        .setThumbnail(mentionedMember.user.displayAvatarURL())
        .setColor('#ebb734')
        .setDescription(`
**Member:** ${mentionedMember.user.username} - (${mentionedMember.user.id})
**Action:** Unmute
**Reason:** ${reason || "Undefined"}
**Channel:** ${message.channel}
**Time:** ${moment().format('llll')}
         `)
        message.channel.send(unmuteembed)
        mentionedMember.roles.remove('735457717354758336')
        return undefined
    // Purge messages
    }else if(message.content.startsWith(`${PREFIX}purge`)) {
        if(!message.member.hasPermission('MANAGE_MESSAGES')) return message.channel.send("You don\'t have permission to do this command")
        if(!message.guild.me.hasPermission('MANAGE_MESSAGES')) return message.channel.send ("I don\'t have permission to do this command")
        if(!args[1]) return message.channel.send("You need to specify amount of message to purge!")
        if(isNaN(args[1])) return message.channel.send("This is not a valid amount of messages to delete")
        if(args[1] > 100 || args[1] < 2) return message.channel.send("Please make sure that you\'re deleting messages from 2 - 100")
        try {
            await message.channel.bulkDelete(args[1])
        } catch {
            return message.channel.send("You can only bulk delete messages within 14 days of age!")
        }
        var purgeembed = new Discord.MessageEmbed()
        .setAuthor(`${message.author.username} - (${message.author.id})`, message.author.displayAvatarURL())
        .setThumbnail(message.author.displayAvatarURL())
        .setColor('#ebb734')
        .setDescription(`
**Deleted:** ${args[1]}
**Action:** Purge
**Channel:** ${message.channel}
**Time:** ${moment().format('llll')}
         `)
         message.channel.send(purgeembed)
    }else if (message.content.startsWith(`${PREFIX}image`)) {
        // call the image function
        image(message, parts);
 
    }
    return undefined

})

// Function to search youtube using youtube API & control queue
async function handleVideo(video, message, voiceChannel, playlist = false) {
    const serverQueue = queue.get(message.guild.id)

    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    }

    if(!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        }
        queue.set(message.guild.id, queueConstruct)

        queueConstruct.songs.push(song)

        try {
            var connection = await voiceChannel.join()
            queueConstruct.connection = connection
            play(message.guild, queueConstruct.songs[0])
        } catch (error) {
            console.log(`There was an error connecting to the voice channel: ${error}`)
            queue.delete(message.guild.id)
            return message.channel.send(`There was an error connecting to the voice channel: ${error}`)
        }
    } else {
        serverQueue.songs.push(song)
        if (playlist) return undefined
        else return message.channel.send(`**${song.title}** has been added to the queue!`)
    }
    return undefined
}

// Play function
function play(guild, song) {
    const serverQueue = queue.get(guild.id)

    if(!song) {
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
        return
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
    .on('finish', () =>{
        serverQueue.songs.shift()
        play(guild, serverQueue.songs[0])
    })
    .on('error', error =>{
        console.log(error)
    })
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

    serverQueue.textChannel.send(`Start Playing: **${song.title}**`)
}

function image(message, parts) {
 
    var search = parts.slice(1).join(" ");
 
    var options = {
        url: "http://results.dogpile.com/serp?qc=images&q=" + search,
        method: "GET",
        headers: {
            "Accept": "text/html",
            "User-Agent": "Chrome"
        }
    };
    request(options, function(error, response, responseBody) {
        if (error) {
            return;
        }

        $ = cheerio.load(responseBody); 

        var links = $(".image a.link");
 
        var urls = new Array(links.length).fill(0).map((v, i) => links.eq(i).attr("href"));
        var pick = urls[Math.floor(Math.random() * urls.length)];
        if (!urls.length) {
            return;
        }
 
        message.channel.send( pick );
    });
 
}

bot.login(token)