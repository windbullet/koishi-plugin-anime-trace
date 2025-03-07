import { Context, Schema, Session, h } from 'koishi'
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
      let model = options.model === "1" ? "anime_model_lovelive" : "pre_stable"
      await detect(model, img, session)
    })

  ctx.command("以图识人.gal [img:image]", "识别图片中的galgame角色")
    .action(async ({session}, img) => {
      await detect("full_game_model_kira", img, session)
    })

  async function detect(model: string, img: JSX.ResourceElement, session: Session<never, never, Context>) {
    let codes = {
      17701: "图片大小过大",
      17702: "服务器繁忙，请重试",
      17703: "请求参数不正确",
      17704: "API 维护中",
      17705: "图片格式不支持",
      17706: "识别无法完成（内部错误，请重试）",
      17707: "内部错误",
      17708: "图片中的人物数量超过限制",
      17709: "无法加载统计数量",
      17710: "图片验证码错误",
      17711: "无法完成识别前准备工作（请重试）",
      17712: "需要图片名称",
      17721: "服务器正常运行中",
      17722: "图片下载失败",
      17723: "未指定 Content-Length",
      17724: "不是图片文件或未指定",
      17725: "未指定图片",
      17726: "JSON 不接受包含文件",
      17727: "Base64 格式错误",
      17728: "已达到本次使用上限",
      17729: "未找到选择的模型",
      17730: "检测 AI 图片失败",
      17731: "服务利用人数过多，请重新尝试",
      404: "页面不存在",
      17732: "已过期",
      17733: "反馈成功",
      17734: "反馈失败",
      17735: "反馈识别效果成功",
      17736: "验证码错误"
  }

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
          await session.send('超时')
        }
      }

      const image = h.select(element, 'img')
      if (image.length === 0) await session.send('这看上去不是图片')

      url = image[0].attrs.src
    }

    session.send(h.quote(session.messageId) + "正在识别中...")

    let imageBuffer = await ctx.http.get(url, {responseType: 'arraybuffer'})
    let formData = new FormData()
    formData.append("model", model)
    formData.append("ai_detect", "1")
    formData.append("file", new Blob([imageBuffer]), "image.png")

    let res = await ctx.http.post("https://api.animetrace.com/v1/search", formData)
    if (![200, 17720, 0].includes(res.code)) await session.send(codes[res.code])
    if (res.data.length === 0 ) await session.send("未识别到角色")

    for (let character of res.data) {
      let image = await Jimp.read(imageBuffer)
      let height = image.bitmap.height
      let width = image.bitmap.width
      let box = character.box
      image.crop({
        x: box[0] * width, 
        y: box[1] * height, 
        w: (box[2] - box[0]) * width, 
        h: (box[3] - box[1]) * height
      })
      let buffer = await image.getBuffer("image/png")

      let result = `<message forward>
<message>
<author id="${session.selfId}"/>
${h.image(buffer, "image/png")}
${session.username}识别的该角色可能是：
</message>`

      for (let possibleCharacter of character.character) {
        result += `<message>
<author id="${session.selfId}"/>
角色名：${possibleCharacter.character}
来自：${possibleCharacter.work}
</message>`
      }

      result += `</message>`

      await session.send(result)
    }
  }

}
