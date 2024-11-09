import { Context, Schema, h } from 'koishi'
import { Jimp } from 'jimp'

export const name = 'anime-trace'

export const usage = "更新日志：https://forum.koishi.xyz/t/topic/9681"

export interface Config {

}

export const Config: Schema<Config> = Schema.object({

})

export function apply(ctx: Context, config: Config) {
  ctx.command("以图识人.动画 [img:image]", "识别图片中的动画角色")
    .option("model", "-m <model> 选择模型：1(默认), 2", {type: /^1$|^2$/, fallback: "1"})
    .action(async ({session, options}, img) => {
      let url: string
      if (img) {
        url = img.src
      } else {
        let element = session.quote?.elements
        if (!element) {
          await session.send("请在30秒内发送一张图片")
          const msg = await session.prompt(30000)
          if (msg !== undefined) {
            element = h.parse(msg)
          } else {
            return '超时'
          }
        }
  
        const image = h.select(element, 'img')
        if (image.length === 0) return '这看上去不是图片'

        url = image[0].attrs.src
      }

      session.send(h.quote(session.messageId) + "正在识别中...")
      
      return h.quote(session.messageId) + await detect(options.model === "1" ? "anime_model_lovelive" : "anime_model", url)
    })

  ctx.command("以图识人.gal [img:image]", "识别图片中的galgame角色")
    .action(async ({session}, img) => {
      let url: string
      if (img) {
        url = img.src
      } else {
        let element = session.quote?.elements
        if (!element) {
          await session.send("请在30秒内发送一张图片")
          const msg = await session.prompt(30000)
          if (msg !== undefined) {
            element = h.parse(msg)
          } else {
            return '超时'
          }
        }
  
        const image = h.select(element, 'img')
        if (image.length === 0) return '这看上去不是图片'

        url = image[0].attrs.src
      }

      session.send(h.quote(session.messageId) + "正在识别中...")
      
      return h.quote(session.messageId) + await detect("game_model_kirakira", url)
    })

    async function detect(model: string, url: string) {
      let codes = {
        17701: "图片大小过大",
        17702: "服务器繁忙，请重试",
        17799: "不明错误发生",
        17703: "请求参数不正确",
        17704: "API维护中",
        17705: "图片格式不支持",
        17706: "识别无法完成（内部错误，请重试）",
        17707: "内部错误",
        17708: "图片中的人物数量超过限制",
        17709: "无法加载统计数量",
        17710: "图片验证码错误",
        17711: "无法完成识别前准备工作（请重试）",
        17712: "需要图片名称"
      }

      let imageBuffer = await ctx.http.get(url, {responseType: 'arraybuffer'})
      let formData = new FormData()
      formData.append("model", model)
      formData.append("ai_detect", "1")
      formData.append("image", new Blob([imageBuffer]), "image.png")

      let res = JSON.parse(await ctx.http.post("https://aiapiv2.animedb.cn/ai/api/detect", formData))
      if (![200, 17720, 0].includes(res.code)) return codes[res.code]
      if (res.data.length === 0 ) return "未识别到角色"
      let result = `${res.ai ? "可能是AI图\n" : ""}`
      for (let charactor of res.data) {
        let image = await Jimp.read(imageBuffer)
        let height = image.bitmap.height
        let width = image.bitmap.width
        let box = charactor.box
        image.crop({
          x: box[0] * width, 
          y: box[1] * height, 
          w: (box[2] - box[0]) * width, 
          h: (box[3] - box[1]) * height
        })
        let buffer = await image.getBuffer("image/png")
        result += `${h.image(buffer, "image/png")}
角色：${charactor.name}
来自：${charactor.cartoonname}\n`
      }
      return result
    }

}
