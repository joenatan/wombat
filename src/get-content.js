const fs = require('fs-extra')
const path = require('path')
const camelCase = require('lodash/camelCase')
const showdown = require('showdown')
const converter = new showdown.Converter()

const filterCollection = require('./get-collection')

const walk = async dir => {
  dir = path.resolve(dir)
  const tree = {}
  const files = await fs.readdir(dir)

  for (let file of files) {
    const filePath = path.join(dir, file)
    const fileName = path.basename(filePath)
    const propName = camelCase(fileName.replace(/\..*/, ''))
    const stat = await fs.stat(filePath)

    if (stat.isDirectory()) {
      tree[propName] = await walk(filePath)
    }

    if (stat.isFile()) {
      const content = await fs.readFile(filePath, 'utf8')
      const extension = path.extname(filePath)

      switch(extension) {
        case '.json':
          tree[propName] = JSON.parse(content)
          break
        case '.md':
          tree[propName] = converter.makeHtml(content)
          break
        default:
          tree[propName] = content
      }
    }
  }

  return tree
}

const relation = (collections, item) => {
  const props = Object.keys(item)

  props.forEach(prop => {
    if (item[prop].collectionName) {
      const collection = collections[item[prop].collectionName]
      const config = item[prop].filter

      item[prop] = filterCollection(collection, config)
    }
  })

  return item
}

module.exports = async () => {
  const dbPath = path.resolve('./db.json')

  if (await fs.pathExists(dbPath)) {
    return JSON.parse(await fs.readFile(dbPath, 'utf8'))
  }

  const content = await walk('./content')

  Object.keys(content).forEach(lang => {
    Object.keys(content[lang].entity).forEach(item => {
      content[lang].entity[item] = relation(
        content[lang].collection,
        content[lang].entity[item]
      )
    })
  })

  return content
}
